import "server-only";

import type { BeautyProfile, RecommendationMode } from "../recommendation/analysis-types";
import type { ImageAsset, StyleReference, StyleReferenceImage } from "../types";

export type BeautyImageRequest = {
  primaryImage: ImageAsset;
  detailImages: ImageAsset[];
  selectedReferenceImages: StyleReferenceImage[];
  selectedReferences: StyleReference[];
  recommendationMode: RecommendationMode;
  beautyProfile: BeautyProfile;
  identityPreservationRules: string[];
  generationPrompt: string;
};

export type BeautyImageResponse = {
  bytes: Uint8Array;
  contentType: "image/png";
  provider: "openai";
  model: string;
};

export interface BeautyImageProvider {
  generate(input: BeautyImageRequest): Promise<BeautyImageResponse>;
}

type FetchLike = typeof fetch;
const OPENAI_IMAGE_MODEL = "gpt-image-2";

export class OpenAIBeautyImageProvider implements BeautyImageProvider {
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly fetcher: FetchLike = fetch
  ) {}

  async generate(input: BeautyImageRequest): Promise<BeautyImageResponse> {
    if (!this.apiKey) {
      throw new Error("OPENAI_NOT_CONFIGURED");
    }

    const form = new FormData();
    form.set("model", OPENAI_IMAGE_MODEL);
    form.set("prompt", input.generationPrompt);
    form.set("quality", "high");
    form.set("size", "auto");
    form.set("output_format", "png");

    const assets = [input.primaryImage, ...input.detailImages];

    for (const [index, asset] of assets.entries()) {
      form.append("image[]", dataUrlBlob(asset.dataUrl), `customer-${index}.png`);
    }

    for (const [index, image] of input.selectedReferenceImages.entries()) {
      const refResponse = await this.fetcher(image.imageUrl, { cache: "no-store" });

      if (!refResponse.ok) {
        const refText = await refResponse.text().catch(() => "");
        throw new Error(
          `REFERENCE_IMAGE_UNAVAILABLE_${refResponse.status}_${refText || "EMPTY_RESPONSE"}`
        );
      }

      form.append("image[]", await refResponse.blob(), `style-${index}.png`);
    }

    const response = await this.fetcher("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("OPENAI_IMAGE_EDIT_ERROR", {
        status: response.status,
        body: errorText,
      });
      throw new Error(`OPENAI_IMAGE_EDIT_FAILED_${response.status}_${errorText || "EMPTY_ERROR"}`);
    }

    const result = (await response.json()) as {
      data?: { b64_json?: string }[];
    };

    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) {
      console.error("OPENAI_IMAGE_EMPTY_RESULT", result);
      throw new Error("OPENAI_IMAGE_EMPTY_RESULT");
    }

    return {
      bytes: Uint8Array.from(Buffer.from(encoded, "base64")),
      contentType: "image/png",
      provider: "openai",
      model: OPENAI_IMAGE_MODEL,
    };
  }
}

function dataUrlBlob(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("INVALID_SIMULATION_IMAGE");
  return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
}
