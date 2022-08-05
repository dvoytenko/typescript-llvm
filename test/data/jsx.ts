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
    type: E, props: JSX.IntrinsicElements[E], ...children: any[]): Node<JSX.IntrinsicElements[E]>;

export function jsx<P>(
    type: ComponentType<P>, props: P, ...children: any[]): Node<P>;

export function jsx(type: any, props: any, ...children: any[]): Node<any> {
  props = props ?? {};
  if (children.length === 1 && children[0] == null) {
    children = [];
  }
  return {type, props, children};
}
