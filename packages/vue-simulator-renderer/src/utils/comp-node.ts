import type { ComponentInternalInstance, VNode } from 'vue';
import type { ComponentInstance } from '../interface';
import { isNil } from '@knxcloud/lowcode-utils';
import { isProxy } from 'vue';
import { isObject } from './check';

const SYMBOL_VDID = Symbol('_LCDocId');
const SYMBOL_VNID = Symbol('_LCNodeId');
const SYMBOL_VInstance = Symbol('_LCVueInstance');
const SYMBOL_RECORD_FLAG = Symbol('_LCVueCompRecord');

export interface VNodeHTMLElement extends HTMLElement {
  __vnode: VNode;
  __vueParentComponent: ComponentInternalInstance;
}

export interface CompRootHTMLElement extends HTMLElement {
  [SYMBOL_VDID]: string;
  [SYMBOL_VNID]: string;
  [SYMBOL_VInstance]: ComponentInstance;
}

export interface CompRootData {
  docId: string;
  nodeId: string;
  instance: ComponentInstance;
}

export class ComponentRecord {
  [SYMBOL_RECORD_FLAG] = true;
  constructor(public did: string, public nid: string, public cid: number) {}
}

export function isVNodeHTMLElement(el: unknown): el is VNodeHTMLElement {
  return isObject(el) && !isNil(el.__vueParentComponent);
}

export function isCompRootHTMLElement(
  el: Element | null | undefined
): el is CompRootHTMLElement {
  return isObject(el) && SYMBOL_VDID in el;
}

export function isComponentRecord(el: unknown): el is ComponentRecord {
  return isObject(el) && SYMBOL_RECORD_FLAG in el;
}

export function isInternalInstance(el: unknown): el is ComponentInternalInstance {
  return isObject(el) && isProxy(el.proxy);
}

export function getCompRootData(el: CompRootHTMLElement): CompRootData {
  return {
    docId: el[SYMBOL_VDID],
    nodeId: el[SYMBOL_VNID],
    instance: el[SYMBOL_VInstance],
  };
}

export function setCompRootData(el: CompRootHTMLElement, data: CompRootData): void {
  el[SYMBOL_VDID] = data.docId;
  el[SYMBOL_VNID] = data.nodeId;
  el[SYMBOL_VInstance] = data.instance;
}
