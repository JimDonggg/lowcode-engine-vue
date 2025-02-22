import type { PropType } from 'vue';
import type { DocumentInstance, VueSimulatorRenderer } from './interface';
import { defineComponent, h, renderSlot } from 'vue';
import LowCodeRenderer from '@knxcloud/lowcode-vue-renderer';
import { RouterView } from 'vue-router';

export const Layout = defineComponent({
  props: {
    simulator: {
      type: Object as PropType<VueSimulatorRenderer>,
      required: true,
    },
  },
  render() {
    const { simulator, $slots } = this;
    const { layout, getComponent } = simulator;
    if (layout) {
      const { Component, props = {}, componentName } = layout;
      if (Component) {
        return h(Component, { ...props, key: 'layout', simulator } as any, $slots);
      }
      const ComputedComponent = componentName && getComponent(componentName);
      if (ComputedComponent) {
        return h(ComputedComponent, { ...props, key: 'layout', simulator }, $slots);
      }
    }
    return renderSlot($slots, 'default');
  },
});

export const SimulatorRendererView = defineComponent({
  props: {
    simulator: {
      type: Object as PropType<VueSimulatorRenderer>,
      required: true,
    },
  },
  render() {
    const { simulator } = this;
    return h(Layout, { simulator }, { default: () => h(RouterView) });
  },
});

export const Renderer = defineComponent({
  props: {
    simulator: {
      type: Object as PropType<VueSimulatorRenderer>,
      required: true,
    },
    documentInstance: {
      type: Object as PropType<DocumentInstance>,
      required: true,
    },
  },
  render() {
    const { documentInstance, simulator } = this;
    const { schema, scope, messages } = documentInstance;
    const { designMode, device, locale, components } = simulator;

    if (!simulator.autoRender) return null;

    return h(LowCodeRenderer, {
      scope: scope,
      schema: schema,
      locale: locale,
      device: device,
      messages: messages,
      components: components,
      designMode: designMode,
      getNode: (id) => documentInstance.getNode(id),
      onCompGetCtx: (schema, ref) => documentInstance.mountInstance(schema.id!, ref),
    });
  },
});
