const base = '/assets/illustrations';

export const stillAssets = {
  plants: {
    yellowBlossoms: `${base}/plants/plant_yellow_blossoms.webp`,
    yellowBlossomsCreamPot: `${base}/plants/plant_yellow_blossoms_cream_pot.webp`,
  },
  nature: {
    flowers: `${base}/nature/nature_flower_cluster_pastel.webp`,
  },
} as const;

export type StillAssetPath = string;
