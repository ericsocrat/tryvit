import { primitiveValue } from "./from-manifest";

export const zIndex = Object.freeze({
  base: primitiveValue("zIndex.base"),
  sticky: primitiveValue("zIndex.sticky"),
  dropdown: primitiveValue("zIndex.dropdown"),
  overlay: primitiveValue("zIndex.overlay"),
  modal: primitiveValue("zIndex.modal"),
  toast: primitiveValue("zIndex.toast"),
});

export type ZIndexLayer = keyof typeof zIndex;
