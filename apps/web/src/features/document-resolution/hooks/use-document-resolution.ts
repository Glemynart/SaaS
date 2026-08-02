import { useMutation } from '@tanstack/react-query';
import {
  documentResolutionApi,
  type DocumentResolutionPayload,
} from '../services/document-resolution-api';

export function usePreviewDocumentResolution() {
  return useMutation({
    mutationFn: (payload: DocumentResolutionPayload) => documentResolutionApi.preview(payload),
  });
}

export function useConfirmDocumentResolution() {
  return useMutation({
    mutationFn: (payload: DocumentResolutionPayload) => documentResolutionApi.confirm(payload),
  });
}
