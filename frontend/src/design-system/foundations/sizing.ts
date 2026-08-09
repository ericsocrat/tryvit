import { primitiveValue } from "./from-manifest";

export const sizing = Object.freeze({
  control: Object.freeze({
    small: primitiveValue("size.control.small"),
    medium: primitiveValue("size.control.medium"),
    large: primitiveValue("size.control.large"),
  }),
  touch: Object.freeze({
    minimum: primitiveValue("size.touch.minimum"),
  }),
  icon: Object.freeze({
    xs: primitiveValue("size.icon.xs"),
    sm: primitiveValue("size.icon.sm"),
    md: primitiveValue("size.icon.md"),
    lg: primitiveValue("size.icon.lg"),
    xl: primitiveValue("size.icon.xl"),
  }),
  avatar: Object.freeze({
    sm: primitiveValue("size.avatar.sm"),
    md: primitiveValue("size.avatar.md"),
    lg: primitiveValue("size.avatar.lg"),
  }),
  media: Object.freeze({
    thumbnail: primitiveValue("size.media.thumbnail"),
    card: primitiveValue("size.media.card"),
    hero: primitiveValue("size.media.hero"),
  }),
  container: Object.freeze({
    compact: primitiveValue("size.container.compact"),
    content: primitiveValue("size.container.content"),
    wide: primitiveValue("size.container.wide"),
    canvas: primitiveValue("size.container.canvas"),
  }),
});
