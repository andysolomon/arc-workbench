import {
  OWNER_KIND_IDS, PARADIGM_IDS, REGION_VARIANTS, VISUAL_FAMILIES,
  type GraphDocument, type GraphEdge, type GraphNode, type GraphRegion, type OwnerKind, type ParadigmId,
  type RegionVariant, type VisualFamily,
} from './document';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isParadigmId(v: unknown): v is ParadigmId { return isStr(v) && (PARADIGM_IDS as readonly string[]).includes(v); }
export function isVisualFamily(v: unknown): v is VisualFamily { return isStr(v) && (VISUAL_FAMILIES as readonly string[]).includes(v); }
export function isRegionVariant(v: unknown): v is RegionVariant { return isStr(v) && (REGION_VARIANTS as readonly string[]).includes(v); }
export function isOwnerKind(v: unknown): v is OwnerKind { return isStr(v) && (OWNER_KIND_IDS as readonly string[]).includes(v); }

export function isGraphNode(v: unknown): v is GraphNode {
  return isObj(v) && isStr(v['id']) && isStr(v['type']) && isStr(v['name']) && isNum(v['x']) && isNum(v['y'])
    && (v['visualFamily'] === undefined || isVisualFamily(v['visualFamily']));
}
export function isGraphEdge(v: unknown): v is GraphEdge {
  return isObj(v) && isStr(v['id']) && isStr(v['from']) && isStr(v['to']) && isStr(v['kind']) && isStr(v['label']) && isNum(v['w']);
}
export function isGraphRegion(v: unknown): v is GraphRegion {
  return isObj(v) && isStr(v['id']) && isRegionVariant(v['variant']) && isStr(v['label'])
    && isNum(v['x']) && isNum(v['y']) && isNum(v['w']) && isNum(v['h'])
    && (v['family'] === undefined || isVisualFamily(v['family']))
    && (v['ownerKind'] === undefined || isOwnerKind(v['ownerKind']));
}
export function isGraphDocument(v: unknown): v is GraphDocument {
  if (!isObj(v) || v['version'] !== 3 || !isStr(v['id']) || !isStr(v['title']) || !isParadigmId(v['paradigm'])) return false;
  const view = v['view'];
  if (!isObj(view) || !isNum(view['x']) || !isNum(view['y']) || !isNum(view['k'])) return false;
  return Array.isArray(v['nodes']) && v['nodes'].every(isGraphNode)
    && Array.isArray(v['edges']) && v['edges'].every(isGraphEdge)
    && Array.isArray(v['regions']) && v['regions'].every(isGraphRegion)
    && isObj(v['metadata']);
}
