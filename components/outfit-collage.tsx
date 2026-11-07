'use client';

import { useEffect, useState } from 'react';
import imageBounds from '@/lib/garment-image-bounds.json';
import type { Item } from '@/lib/wardrobe';

type ImageBounds = { width: number; height: number; bounds: number[] };
const importedBounds: Record<string, ImageBounds> = imageBounds;

// One shared drawing scale: approximate garment proportions, not body measurements.
// Transparent export margins do not count toward the visible garment's size.
const heights = { tee: 460, crewneck: 490, hoodie: 535, pants: 680, shorts: 340, outerwear: 570 };

function Garment({ item, x, y }: { item: Item; x: number; y: number }) {
  const [loaded, setLoaded] = useState<{ src: string; geometry: ImageBounds }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (importedBounds[item.image]) return;
    let active = true;
    const photo = new Image();
    photo.onload = () => {
      if (!active) return;
      const { naturalWidth: width, naturalHeight: height } = photo;
      setLoaded({ src: item.image, geometry: { width, height, bounds: [0, 0, width, height] } });
    };
    photo.onerror = () => { if (active) setFailed(true); };
    photo.src = item.image;
    return () => { active = false; };
  }, [item.image]);
  const geometry = importedBounds[item.image] || (loaded?.src === item.image ? loaded.geometry : undefined);
  const ratio = geometry ? geometry.bounds[2] / geometry.bounds[3] : 1;
  const category = item.category;
  const width = category === 'shoes' ? 290 : category === 'cap' ? 190 : heights[category] * ratio;
  // Wide shorts still fit the bottom slot; scale both dimensions to retain their shape.
  const fittedWidth = category === 'shorts' ? Math.min(width, 430) : width;
  const height = fittedWidth / ratio;
  return <svg x={x} y={y} width={fittedWidth} height={height} viewBox={geometry?.bounds.join(' ') || '0 0 100 100'}
    className="collage-garment" role="img" aria-label={item.name} data-category={item.category}>
    <title>{item.name}</title>
    {failed ? <text x="5%" y="50%" fontSize="14">Photo unavailable</text> :
      <image href={item.image} width={geometry?.width || 100} height={geometry?.height || 100} onError={() => setFailed(true)} />}
  </svg>;
}

export function Collage({ items, small = false }: { items: Item[]; small?: boolean }) {
  const layered = items.some(i => i.category === 'crewneck' || i.category === 'hoodie');
  const outerwear = items.some(i => i.category === 'outerwear');
  const position = (item: Item): [number, number] => {
    if (outerwear) {
      if (item.category === 'tee') return [70, 50];
      if (item.category === 'shorts') return [810, 55];
      if (item.category === 'pants') return [880, 55];
      if (item.category === 'cap') return [900, 800];
      if (item.category === 'shoes') return [810, 1090];
      if (item.category === 'outerwear') return [60, 610];
      return [400, 350];
    }
    if (item.category === 'tee') return layered ? [70, 40] : [145, 85];
    if (item.category === 'shorts') return layered ? [815, 45] : [795, 45];
    if (item.category === 'pants') return layered ? [885, 45] : [795, 45];
    if (item.category === 'cap') return layered ? [65, 685] : [150, 665];
    if (item.category === 'shoes') return layered ? [745, 795] : [540, 770];
    return [365, 270];
  };
  // Draw the tee first so its neckline/graphic remain visible behind the midlayer.
  const order = ['tee', 'outerwear', 'crewneck', 'hoodie', 'pants', 'shorts', 'cap', 'shoes'];
  return <div className={'collage proportional-collage' + (small ? ' mini' : '')}>
    <svg className="collage-canvas" viewBox={`0 0 1280 ${outerwear ? 1320 : 960}`} aria-label="Outfit with proportionally scaled garments">
      {[...items].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category)).map(item => {
        const [x, y] = position(item);
        return <Garment key={item.id} item={item} x={x} y={y} />;
      })}
    </svg>
  </div>;
}
