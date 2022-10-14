/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

declare namespace JSX {
  export interface IntrinsicElements {
    a: HTMLAttributes & {href?: string};
    div: HTMLAttributes;
    main: HTMLAttributes;
    h1: HTMLAttributes;
  }

  export type HTMLAttributes = HTMLStandardAttributes & CustomAttributes;

  // An object with keys that must contain the "-" character.
  export interface CustomAttributes {
    [key: `${string}-${string}`]: any;
  }

  export interface HTMLStandardAttributes {
    id?: string;
    className?: string;
    disabled?: boolean;
    style?: string | CSSProperties;
  }

	export interface CSSProperties {
		cssText?: string | null;
    // TODO: ...
	}
}

// TODO: For some reason Cider is really asking for it!?
declare var React: any;



// export interface Node<P = {}> {
//   type: string|ComponentType<P>;
//   props: P;
//   children: any[];
// }

// export interface ComponentType<P = {}> {
//   (props: Props<P>): Node<P>|null|undefined;
// }

// export type Props<P = {}> = P & {children?: any};

// export function jsx<E extends keyof JSX.IntrinsicElements>(
//     type: E, props: JSX.IntrinsicElements[E], ...children: any[]): Node<JSX.IntrinsicElements[E]>;

// export function jsx<P>(
//     type: ComponentType<P>, props: P, ...children: any[]): Node<P>;

// export function jsx(type: any, props: any, ...children: any[]): Node<any> {
//   props = props ?? {};
//   if (children.length === 1 && children[0] == null) {
//     children = [];
//   }
//   return {type, props, children};
// }


export interface Node<P = {}> {
  type: string|ComponentType<P>;
  props: P;
  children: any[];
}

export interface ComponentType<P = {}> {
  (props: Props<P>): Node<P>|null|undefined;
}

export type Props<P = {}> = P & {children?: any};

export function jsx<E extends keyof JSX.IntrinsicElements>(
    type: E, props: JSX.IntrinsicElements[E], children: any[]): Node<JSX.IntrinsicElements[E]> {
  return {type: type, props: props, children: children};
}
