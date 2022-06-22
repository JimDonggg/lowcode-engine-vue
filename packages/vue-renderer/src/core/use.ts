import {
  Component,
  h,
  VNode,
  createTextVNode,
  computed,
  ref,
  Ref,
  ComputedRef,
  Slots,
  Slot,
} from 'vue';
import {
  CompositeValue,
  isJSSlot,
  NodeData,
  NodeSchema,
  TransformStage,
  JSFunction,
  isJSFunction,
  isDOMText,
  isNodeSchema,
  isJSExpression,
} from '@alilc/lowcode-types';
import { isString, isNil, camelCase } from 'lodash-es';
import { useRendererContext } from '../context';
import { RendererProps } from './base';
import { Hoc } from './hoc';
import { Live } from './live';
import { ensureArray, mergeScope, parseSchema } from '../utils';
import { SlotNode } from '@alilc/lowcode-designer';

export type SlotSchemaMap = {
  [x: string]: NodeData[] | undefined;
};

export type PropSchemaMap = {
  [x: string]: unknown;
};

export function isNodeData(val: unknown): val is NodeData | NodeData[] {
  if (Array.isArray(val)) {
    return val.every((item) => isNodeData(item));
  }
  return isDOMText(val) || isNodeSchema(val) || isJSExpression(val);
}

export function useRenderer(props: RendererProps) {
  const { components, getNode, designMode } = useRendererContext();

  const node = getNode(props.schema.id!);

  const isDesignMode = designMode === 'design';

  const render = (
    schema: NodeData,
    Base: Component,
    blockScope: any,
    Comp?: Component
  ) => {
    const mergedScope = mergeScope(props.scope, blockScope);
    if (isString(schema)) {
      return createTextVNode(schema);
    } else if (isJSExpression(schema)) {
      const result = parseSchema(schema, mergedScope);
      if (result == null) {
        return null;
      } else if (isString(result)) {
        return createTextVNode(result);
      } else {
        return h(result);
      }
    }
    if (!Comp) {
      const { componentName } = schema;
      Comp = components[componentName];
    }
    return h(Base, {
      comp: Comp,
      id: schema.id!,
      key: schema.id,
      schema: schema,
      scope: mergedScope,
    } as any);
  };

  const renderHoc = (
    nodeSchema: NodeData,
    blockScope?: any,
    Comp?: Component
  ): VNode | null => {
    return render(nodeSchema, Hoc, blockScope, Comp);
  };

  const renderLive = (
    nodeSchema: NodeData,
    blockScope?: any,
    Comp?: Component
  ): VNode | null => {
    return render(nodeSchema, Live, blockScope, Comp);
  };

  const renderComp = isDesignMode ? renderHoc : renderLive;

  const createSlot = (slotNode: SlotNode) => {
    return slotNode.export(TransformStage.Render);
  };

  const buildSchema = () => {
    const { schema } = props;

    const slotProps: SlotSchemaMap = {};
    const normalProps: PropSchemaMap = {};

    slotProps.default = ensureArray(schema.children);

    Object.entries(schema.props ?? {}).forEach(([key, val]) => {
      if (isJSSlot(val) && val.value) {
        const children = val.value;
        slotProps[key] = ensureArray(children);
      } else if (key === 'className') {
        normalProps.class = val;
      } else if (key === 'children' && isNodeData(val)) {
        slotProps.default = ensureArray(val);
      } else {
        normalProps[key] = val;
      }
    });

    return { props: normalProps, slots: slotProps };
  };

  const buildProps = (props: any, blockScope?: any) => {
    // 属性预处理
    const processed = Object.keys(props).reduce((prev, next) => {
      const val = props[next];
      if (next.startsWith('v-model')) {
        // 双向绑定逻辑
        const matched = next.match(/v-model(?::(\w+))?$/);
        if (!matched) return prev;

        const valueProp = camelCase(matched[1] ?? 'modelValue');
        const eventProp = `onUpdate:${valueProp}`;
        if (isJSExpression(val)) {
          const updateEventFn: JSFunction = {
            type: 'JSFunction',
            value: `function ($event) {${val.value} = $event}`,
          };
          prev[eventProp] =
            eventProp in prev
              ? ensureArray(prev[eventProp]).concat(updateEventFn)
              : updateEventFn;
        }
        prev[valueProp] = val;
      } else if (next.startsWith('v-') && isJSExpression(val)) {
        // TODO: 指令绑定逻辑
      } else if (next.match(/^on[A-Z]/) && isJSFunction(val)) {
        // 事件绑定逻辑

        // normalize: onUpdateXxx => onUpdate:xxx
        const matched = next.match(/onUpdate(?::?(\w+))$/);
        if (matched) {
          next = `onUpdate:${camelCase(matched[1])}`;
        }

        // 若事件名称重复，则自动转化为数组
        prev[next] = next in prev ? ensureArray(prev[next]).concat(val) : val;
      } else {
        prev[next] = val;
      }
      return prev;
    }, {} as Record<string, any>);

    return parseSchema(processed, mergeScope(props.scope, blockScope));
  };

  const buildLoop = (schema: NodeSchema) => {
    const loop = ref() as Ref<CompositeValue>;
    const loopArgs = ref(['item', 'index']) as Ref<[string, string]>;

    if (schema.loop) loop.value = schema.loop;
    if (schema.loopArgs) {
      schema.loopArgs.forEach((v, i) => {
        loopArgs.value[i] = v;
      });
    }

    return {
      loop: computed<unknown[] | null>(() => {
        if (!loop.value) return null;
        return parseSchema(loop.value, props.scope);
      }),
      loopArgs,
      updateLoop(value: CompositeValue) {
        loop.value = value;
      },
      updateLoopArg(value: string, idx?: number): void {
        if (Array.isArray(value)) {
          value.forEach((v, i) => {
            loopArgs.value[i] = v;
          });
        } else if (!isNil(idx)) {
          loopArgs.value[idx] = value;
        }
      },
    } as {
      loop: ComputedRef<unknown[] | null>;
      loopArgs: Ref<[string, string]>;
      updateLoop(value: CompositeValue): void;
      updateLoopArg(value: [string, string]): void;
      updateLoopArg(value: string, idx?: number | string): void;
    };
  };

  const buildSlost = (slots: SlotSchemaMap, blockScope?: any): Slots => {
    return Object.keys(slots).reduce((prev, next) => {
      const slotSchema = slots[next];
      if (slotSchema) {
        const renderSlot = () => {
          const vnodes: VNode[] = [];
          slotSchema.forEach((schema) => {
            const vnode = renderComp(schema, blockScope);
            vnode && vnodes.push(vnode);
          });
          return vnodes;
        };

        if (next === 'default') {
          prev[next] = () => {
            const vnodes = renderSlot();
            if (isDesignMode && !vnodes.length && node?.isContainer()) {
              vnodes.push(h('div', { class: 'lc-container' }));
            }
            return vnodes;
          };
        } else if (slotSchema.length > 0) {
          prev[next] = renderSlot;
        }
      }
      return prev;
    }, {} as Record<string, Slot>);
  };

  return {
    renderComp,
    createSlot,
    buildLoop,
    buildProps,
    buildSlost,
    buildSchema,
  };
}
