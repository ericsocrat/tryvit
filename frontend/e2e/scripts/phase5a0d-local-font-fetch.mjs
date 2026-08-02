import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

const PINNED_FONT_URL =
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf";
const PINNED_FONT_SHA256 = "c1c6ba111e8d04d392b741d194ab548186ec3c006ed7cc134be0525402520339";
const PINNED_FONT_BYTES = 344_068;
const fixturePath = fileURLToPath(
  new URL("../fixtures/phase5a0d/inter-bold-c1c6ba11.ttf", import.meta.url),
);

let fixture;
let fixtureDescriptor;
try {
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  fixtureDescriptor = openSync(fixturePath, constants.O_RDONLY | noFollow);
  const descriptorMetadata = fstatSync(fixtureDescriptor, { bigint: true });
  const pathMetadata = lstatSync(fixturePath, { bigint: true });
  if (
    !descriptorMetadata.isFile() ||
    !pathMetadata.isFile() ||
    pathMetadata.isSymbolicLink() ||
    descriptorMetadata.dev !== pathMetadata.dev ||
    descriptorMetadata.ino !== pathMetadata.ino ||
    realpathSync.native(fixturePath) !== fixturePath
  ) {
    throw new Error("[VS_LOCAL_FONT] pinned-font-path-invalid");
  }
  fixture = readFileSync(fixtureDescriptor);
} catch (error) {
  if (error instanceof Error && error.message === "[VS_LOCAL_FONT] pinned-font-path-invalid") {
    throw error;
  }
  throw new Error("[VS_LOCAL_FONT] pinned-font-path-invalid", { cause: error });
} finally {
  if (fixtureDescriptor !== undefined) closeSync(fixtureDescriptor);
}
if (
  fixture.byteLength !== PINNED_FONT_BYTES ||
  createHash("sha256").update(fixture).digest("hex") !== PINNED_FONT_SHA256
) {
  throw new Error("[VS_LOCAL_FONT] pinned-font-content-invalid");
}

const nativeFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input) {
  if (typeof input === "string" || input instanceof URL) return new URL(input).href;
  if (input instanceof Request) return new URL(input.url).href;
  throw new Error("[VS_LOCAL_FONT] unsupported-fetch-input");
}

globalThis.fetch = async (input, init) => {
  const url = requestUrl(input);
  if (url === PINNED_FONT_URL) {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (method.toUpperCase() !== "GET") {
      throw new Error("[VS_LOCAL_FONT] pinned-font-method-invalid");
    }
    return new Response(fixture, {
      status: 200,
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-length": String(fixture.byteLength),
        "content-type": "font/ttf",
      },
    });
  }
  if (new URL(url).hostname === "fonts.gstatic.com") {
    throw new Error("[VS_LOCAL_FONT] unpinned-font-url-rejected");
  }
  return nativeFetch(input, init);
};
