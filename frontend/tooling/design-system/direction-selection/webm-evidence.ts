const IDS = Object.freeze({
  ebml: 0x1a45dfa3,
  docType: 0x4282,
  segment: 0x18538067,
  info: 0x1549a966,
  timecodeScale: 0x2ad7b1,
  duration: 0x4489,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  trackNumber: 0xd7,
  trackType: 0x83,
  codecId: 0x86,
  video: 0xe0,
  pixelWidth: 0xb0,
  pixelHeight: 0xba,
  cluster: 0x1f43b675,
  clusterTimecode: 0xe7,
  simpleBlock: 0xa3,
  blockGroup: 0xa0,
  block: 0xa1,
  blockDuration: 0x9b,
  void: 0xec,
});

export type PlaywrightWebmCodec = "V_MJPEG" | "V_VP8";

export interface VerifiedPlaywrightWebm {
  readonly codec: PlaywrightWebmCodec;
  readonly width: number;
  readonly height: number;
  readonly durationMs: number;
  readonly frameCount: number;
  readonly keyFrameCount: number;
  readonly clusterCount: number;
}

interface EbmlElement {
  readonly id: number;
  readonly dataStart: number;
  readonly dataEnd: number;
  readonly end: number;
  readonly sizeUnknown: boolean;
}

interface VideoTrack {
  readonly number: number;
  readonly codec: PlaywrightWebmCodec;
  readonly width: number;
  readonly height: number;
}

function fail(reason: string): never {
  throw new Error(`[P5A2_EVIDENCE] candidate-video-${reason}`);
}

function vintLength(firstByte: number, maximum: number, reason: string): number {
  if (firstByte === 0) fail(reason);
  let mask = 0x80;
  for (let length = 1; length <= maximum; length += 1) {
    if ((firstByte & mask) !== 0) return length;
    mask >>= 1;
  }
  fail(reason);
}

function readElementId(bytes: Buffer, offset: number, limit: number): {
  readonly value: number;
  readonly length: number;
} {
  if (offset >= limit) fail("element-id-truncated");
  const length = vintLength(bytes[offset] as number, 4, "element-id-invalid");
  if (offset + length > limit) fail("element-id-truncated");
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value = value * 256 + (bytes[offset + index] as number);
  }
  return { value, length };
}

function readSizeVint(bytes: Buffer, offset: number, limit: number): {
  readonly value: number;
  readonly length: number;
  readonly unknown: boolean;
} {
  if (offset >= limit) fail("element-size-truncated");
  const firstByte = bytes[offset] as number;
  const length = vintLength(firstByte, 8, "element-size-invalid");
  if (offset + length > limit) fail("element-size-truncated");
  const marker = 1 << (8 - length);
  const valueMask = marker - 1;
  const unknown =
    (firstByte & valueMask) === valueMask &&
    Array.from({ length: length - 1 }, (_, index) => bytes[offset + index + 1])
      .every((byte) => byte === 0xff);
  if (unknown) return { value: 0, length, unknown: true };
  let value = firstByte & valueMask;
  for (let index = 1; index < length; index += 1) {
    const byte = bytes[offset + index] as number;
    if (value > Math.floor((Number.MAX_SAFE_INTEGER - byte) / 256)) {
      fail("element-size-unsafe");
    }
    value = value * 256 + byte;
  }
  return { value, length, unknown: false };
}

function readElement(
  bytes: Buffer,
  offset: number,
  limit: number,
  allowUnknownSize = false,
): EbmlElement {
  const id = readElementId(bytes, offset, limit);
  const size = readSizeVint(bytes, offset + id.length, limit);
  if (size.unknown && !allowUnknownSize) fail("element-size-unknown");
  const dataStart = offset + id.length + size.length;
  const dataEnd = size.unknown ? limit : dataStart + size.value;
  if (dataEnd < dataStart || dataEnd > limit) fail("element-truncated");
  return {
    id: id.value,
    dataStart,
    dataEnd,
    end: dataEnd,
    sizeUnknown: size.unknown,
  };
}

function childElements(bytes: Buffer, start: number, end: number): EbmlElement[] {
  const output: EbmlElement[] = [];
  let cursor = start;
  while (cursor < end) {
    const element = readElement(bytes, cursor, end);
    if (element.end <= cursor) fail("element-progress-invalid");
    output.push(element);
    cursor = element.end;
  }
  if (cursor !== end) fail("element-boundary-invalid");
  return output;
}

function readUnsigned(bytes: Buffer, element: EbmlElement, reason: string): number {
  const length = element.dataEnd - element.dataStart;
  if (length < 1 || length > 8) fail(reason);
  let value = 0;
  for (let offset = element.dataStart; offset < element.dataEnd; offset += 1) {
    const byte = bytes[offset] as number;
    if (value > Math.floor((Number.MAX_SAFE_INTEGER - byte) / 256)) fail(reason);
    value = value * 256 + byte;
  }
  return value;
}

function readFloat(bytes: Buffer, element: EbmlElement, reason: string): number {
  const length = element.dataEnd - element.dataStart;
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + element.dataStart,
    length,
  );
  if (length === 4) return view.getFloat32(0, false);
  if (length === 8) return view.getFloat64(0, false);
  fail(reason);
}

function readString(bytes: Buffer, element: EbmlElement): string {
  return bytes.subarray(element.dataStart, element.dataEnd).toString("utf8");
}

function oneElement(
  elements: readonly EbmlElement[],
  id: number,
  reason: string,
  required = true,
): EbmlElement | undefined {
  const matches = elements.filter((element) => element.id === id);
  if (matches.length > 1 || (required && matches.length !== 1)) fail(reason);
  return matches[0];
}

function parseVideoTrack(bytes: Buffer, tracks: EbmlElement): VideoTrack {
  const entries = childElements(bytes, tracks.dataStart, tracks.dataEnd)
    .filter((element) => element.id === IDS.trackEntry);
  const videoTracks: VideoTrack[] = [];
  for (const entry of entries) {
    const fields = childElements(bytes, entry.dataStart, entry.dataEnd);
    const type = oneElement(fields, IDS.trackType, "track-type-invalid");
    if (!type || readUnsigned(bytes, type, "track-type-invalid") !== 1) continue;
    const number = oneElement(fields, IDS.trackNumber, "track-number-invalid");
    const codecId = oneElement(fields, IDS.codecId, "track-codec-invalid");
    const video = oneElement(fields, IDS.video, "track-video-invalid");
    if (!number || !codecId || !video) fail("track-video-invalid");
    const codec = readString(bytes, codecId);
    if (codec !== "V_MJPEG" && codec !== "V_VP8") fail("codec-unsupported");
    const videoFields = childElements(bytes, video.dataStart, video.dataEnd);
    const width = oneElement(videoFields, IDS.pixelWidth, "track-width-invalid");
    const height = oneElement(videoFields, IDS.pixelHeight, "track-height-invalid");
    if (!width || !height) fail("track-dimensions-invalid");
    videoTracks.push({
      number: readUnsigned(bytes, number, "track-number-invalid"),
      codec,
      width: readUnsigned(bytes, width, "track-width-invalid"),
      height: readUnsigned(bytes, height, "track-height-invalid"),
    });
  }
  if (videoTracks.length !== 1) fail("video-track-count-invalid");
  return videoTracks[0] as VideoTrack;
}

function jpegDimensions(frame: Buffer): { readonly width: number; readonly height: number } {
  if (
    frame.length < 12 ||
    frame[0] !== 0xff ||
    frame[1] !== 0xd8 ||
    frame[frame.length - 2] !== 0xff ||
    frame[frame.length - 1] !== 0xd9
  ) {
    fail("jpeg-frame-invalid");
  }
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let dimensions: { width: number; height: number } | undefined;
  let cursor = 2;
  while (cursor < frame.length - 2) {
    if (frame[cursor] !== 0xff) fail("jpeg-marker-invalid");
    while (cursor < frame.length && frame[cursor] === 0xff) cursor += 1;
    if (cursor >= frame.length) fail("jpeg-marker-truncated");
    const marker = frame[cursor] as number;
    cursor += 1;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (cursor + 2 > frame.length) fail("jpeg-segment-truncated");
    const segmentLength = frame.readUInt16BE(cursor);
    if (segmentLength < 2 || cursor + segmentLength > frame.length) {
      fail("jpeg-segment-truncated");
    }
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) fail("jpeg-sof-invalid");
      dimensions = {
        height: frame.readUInt16BE(cursor + 3),
        width: frame.readUInt16BE(cursor + 5),
      };
      if (dimensions.width < 1 || dimensions.height < 1) fail("jpeg-dimensions-invalid");
    }
    if (marker === 0xda) {
      if (!dimensions) fail("jpeg-sof-missing");
      return dimensions;
    }
    cursor += segmentLength;
  }
  if (!dimensions) fail("jpeg-sof-missing");
  return dimensions;
}

function vp8KeyFrameDimensions(
  frame: Buffer,
): { readonly keyFrame: boolean; readonly width?: number; readonly height?: number } {
  if (frame.length < 3) fail("vp8-frame-truncated");
  const keyFrame = ((frame[0] as number) & 0x01) === 0;
  if (!keyFrame) return { keyFrame: false };
  if (
    frame.length < 10 ||
    frame[3] !== 0x9d ||
    frame[4] !== 0x01 ||
    frame[5] !== 0x2a
  ) {
    fail("vp8-keyframe-invalid");
  }
  return {
    keyFrame: true,
    width: frame.readUInt16LE(6) & 0x3fff,
    height: frame.readUInt16LE(8) & 0x3fff,
  };
}

function readBlockTrackNumber(frame: Buffer): { readonly value: number; readonly length: number } {
  if (frame.length === 0) fail("block-truncated");
  const firstByte = frame[0] as number;
  const length = vintLength(firstByte, 8, "block-track-invalid");
  if (length + 3 > frame.length) fail("block-truncated");
  const marker = 1 << (8 - length);
  let value = firstByte & (marker - 1);
  for (let index = 1; index < length; index += 1) {
    const byte = frame[index] as number;
    if (value > Math.floor((Number.MAX_SAFE_INTEGER - byte) / 256)) {
      fail("block-track-invalid");
    }
    value = value * 256 + byte;
  }
  if (value < 1) fail("block-track-invalid");
  return { value, length };
}

function parseBlock(
  bytes: Buffer,
  element: EbmlElement,
): {
  readonly trackNumber: number;
  readonly relativeTimecode: number;
  readonly frame: Buffer;
} {
  const payload = bytes.subarray(element.dataStart, element.dataEnd);
  const track = readBlockTrackNumber(payload);
  const relativeTimecode = payload.readInt16BE(track.length);
  const flags = payload[track.length + 2] as number;
  if ((flags & 0x06) !== 0) fail("block-lacing-unsupported");
  const frame = payload.subarray(track.length + 3);
  if (frame.length === 0) fail("frame-empty");
  return { trackNumber: track.value, relativeTimecode, frame };
}

export function verifyPlaywrightWebm(
  bytes: Buffer,
  options: Readonly<{
    expectedWidth: number;
    expectedHeight: number;
    minimumDurationMs: number;
    maximumDurationMs: number;
    minimumFrameCount?: number;
  }>,
): VerifiedPlaywrightWebm {
  if (bytes.length < 32) fail("container-truncated");
  const ebml = readElement(bytes, 0, bytes.length);
  if (ebml.id !== IDS.ebml) fail("ebml-header-missing");
  const ebmlFields = childElements(bytes, ebml.dataStart, ebml.dataEnd);
  const docType = oneElement(ebmlFields, IDS.docType, "doctype-invalid");
  if (!docType || readString(bytes, docType) !== "webm") fail("doctype-invalid");

  let cursor = ebml.end;
  while (cursor < bytes.length) {
    const candidate = readElement(bytes, cursor, bytes.length, true);
    if (candidate.id !== IDS.void) break;
    if (candidate.sizeUnknown) fail("void-size-unknown");
    cursor = candidate.end;
  }
  const segment = readElement(bytes, cursor, bytes.length, true);
  if (segment.id !== IDS.segment || segment.end !== bytes.length) {
    fail("segment-invalid");
  }
  const segmentFields = childElements(bytes, segment.dataStart, segment.dataEnd);
  const info = oneElement(segmentFields, IDS.info, "info-invalid");
  const tracks = oneElement(segmentFields, IDS.tracks, "tracks-invalid");
  if (!info || !tracks) fail("metadata-missing");
  const infoFields = childElements(bytes, info.dataStart, info.dataEnd);
  const timecodeScaleElement = oneElement(
    infoFields,
    IDS.timecodeScale,
    "timecode-scale-invalid",
    false,
  );
  const durationElement = oneElement(infoFields, IDS.duration, "duration-invalid");
  if (!durationElement) fail("duration-invalid");
  const timecodeScale = timecodeScaleElement
    ? readUnsigned(bytes, timecodeScaleElement, "timecode-scale-invalid")
    : 1_000_000;
  const durationTicks = readFloat(bytes, durationElement, "duration-invalid");
  const durationMs = durationTicks * timecodeScale / 1_000_000;
  if (
    !Number.isFinite(durationMs) ||
    durationMs < options.minimumDurationMs ||
    durationMs > options.maximumDurationMs
  ) {
    fail("duration-invalid");
  }

  const videoTrack = parseVideoTrack(bytes, tracks);
  if (
    videoTrack.width !== options.expectedWidth ||
    videoTrack.height !== options.expectedHeight
  ) {
    fail("track-dimensions-mismatch");
  }

  const clusters = segmentFields.filter((element) => element.id === IDS.cluster);
  if (clusters.length === 0 || clusters.some((cluster) => cluster.sizeUnknown)) {
    fail("cluster-count-invalid");
  }
  let frameCount = 0;
  let keyFrameCount = 0;
  let maximumFrameTimeMs = 0;
  for (const cluster of clusters) {
    const fields = childElements(bytes, cluster.dataStart, cluster.dataEnd);
    const clusterTimecodeElement = oneElement(
      fields,
      IDS.clusterTimecode,
      "cluster-timecode-invalid",
    );
    if (!clusterTimecodeElement) fail("cluster-timecode-invalid");
    const clusterTimecode = readUnsigned(
      bytes,
      clusterTimecodeElement,
      "cluster-timecode-invalid",
    );
    const blocks: Array<{ element: EbmlElement; durationTicks?: number }> = [];
    for (const field of fields) {
      if (field.id === IDS.simpleBlock) {
        blocks.push({ element: field });
      } else if (field.id === IDS.blockGroup) {
        const blockFields = childElements(bytes, field.dataStart, field.dataEnd);
        const block = oneElement(blockFields, IDS.block, "block-group-invalid");
        const blockDuration = oneElement(
          blockFields,
          IDS.blockDuration,
          "block-duration-invalid",
          false,
        );
        if (!block) fail("block-group-invalid");
        blocks.push({
          element: block,
          durationTicks: blockDuration
            ? readUnsigned(bytes, blockDuration, "block-duration-invalid")
            : undefined,
        });
      }
    }
    let clusterVideoFrames = 0;
    for (const blockEntry of blocks) {
      const block = parseBlock(bytes, blockEntry.element);
      if (block.trackNumber !== videoTrack.number) continue;
      const timestampTicks = clusterTimecode + block.relativeTimecode;
      if (timestampTicks < 0) fail("frame-timecode-invalid");
      const frameTimeMs = timestampTicks * timecodeScale / 1_000_000;
      const frameEndMs = blockEntry.durationTicks === undefined
        ? frameTimeMs
        : frameTimeMs + blockEntry.durationTicks * timecodeScale / 1_000_000;
      maximumFrameTimeMs = Math.max(maximumFrameTimeMs, frameEndMs);
      clusterVideoFrames += 1;
      frameCount += 1;

      if (videoTrack.codec === "V_MJPEG") {
        const dimensions = jpegDimensions(block.frame);
        if (
          dimensions.width !== options.expectedWidth ||
          dimensions.height !== options.expectedHeight
        ) {
          fail("jpeg-dimensions-mismatch");
        }
        keyFrameCount += 1;
      } else {
        const vp8 = vp8KeyFrameDimensions(block.frame);
        if (vp8.keyFrame) {
          if (vp8.width !== options.expectedWidth || vp8.height !== options.expectedHeight) {
            fail("vp8-dimensions-mismatch");
          }
          keyFrameCount += 1;
        }
      }
    }
    if (clusterVideoFrames === 0) fail("cluster-video-frame-missing");
  }

  if (frameCount < (options.minimumFrameCount ?? 2)) fail("frame-count-invalid");
  if (keyFrameCount < 1) fail("keyframe-missing");
  if (maximumFrameTimeMs > durationMs + 1_000) fail("frame-duration-mismatch");

  return Object.freeze({
    codec: videoTrack.codec,
    width: videoTrack.width,
    height: videoTrack.height,
    durationMs: Number(durationMs.toFixed(3)),
    frameCount,
    keyFrameCount,
    clusterCount: clusters.length,
  });
}
