import { request } from '@/api/client';
import type { SignerAssetResponseDto } from '@/types/api';
import type { SignaturesPort } from '@/services/ports';
import type { SignerAssets } from '@/types/domain';

function fromSignerAssetResponse(dto: SignerAssetResponseDto): SignerAssets {
  return {
    hasStamp: dto.hasStamp,
    hasSignature: dto.hasSignature,
    stampPreviewUrl: dto.stampPreviewUrl,
    signaturePreviewUrl: dto.signaturePreviewUrl,
  };
}

/**
 * Portage réel — `signature-service` (`SignerAssetController`). Seule part
 * de `SignaturesPort` portée pour l'instant (task #230) ; le reste (acte de
 * signature, liste des documents signés…) reste sur le mock — voir le
 * commentaire de `src/api/index.ts`.
 */
export function createSignerAssetsApi(): Pick<SignaturesPort, 'getMyAssets' | 'updateMyAssets'> {
  return {
    async getMyAssets(): Promise<SignerAssets> {
      const dto = await request<SignerAssetResponseDto>('/api/v1/signatures/assets/me');
      return fromSignerAssetResponse(dto);
    },

    async updateMyAssets(input): Promise<SignerAssets> {
      const formData = new FormData();
      if (input.stamp) formData.append('stamp', input.stamp);
      if (input.signature) formData.append('signature', input.signature);
      const dto = await request<SignerAssetResponseDto>('/api/v1/signatures/assets', { method: 'POST', formData });
      return fromSignerAssetResponse(dto);
    },
  };
}
