import { z } from 'zod';

export const emojis = ['🔥', '✨', '💎', '🦋', '💖', '⚡', '🌸', '🌟', '👑', '🪩', '😎', '💫', '🪐', '🚀', '🌈', '🌺', '🍒', '🍋', '🧊', '🎸', '🎵', '🪽', '🐉', '🐍', '🦚', '🐆', '🌊', '☄️', '🌙', '⭐', '🫧', '🎆', '🎇', '💥', '❤️‍🔥', '🩷', '🧿', '🌻', '🥀', '🍀', '🦄', '🎀', '🌀'];
export const scenes = ['galaxy', 'inferno', 'electric', 'butterflies', 'disco', 'vortex'];
export const anchors = ['head', 'shoulders', 'hips', 'feet', 'body'];
export const animations = ['orbit', 'float', 'burst', 'halo', 'spiral', 'rain', 'pulse'];
export const verdictSchema = z.object({
  visible: z.boolean(),
  title: z.string().min(1).max(55),
  reaction: z.string().min(1).max(180),
  tip: z.string().min(1).max(160),
  score: z.number().int().min(1).max(10),
  palette: z.enum(['lime', 'pink', 'blue', 'gold']),
  scene: z.enum(scenes),
  energy: z.number().int().min(1).max(3),
  occasion: z.enum(['Everyday', 'Work', 'Night out', 'Activewear', 'Runway', 'Unclear']),
  formats: z.array(z.enum(['glints', 'trails', 'confetti', 'wings', 'prisms', 'flames', 'stickers', 'letters'])).min(2).max(3),
  effects: z.array(z.object({
    emoji: z.enum(emojis),
    anchor: z.enum(anchors),
    animation: z.enum(animations),
  })).min(2).max(6),
});
export const imageSchema = z.object({
  image: z.string().max(4_000_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
  previousScene: z.enum(scenes).optional(),
});

export const previewVerdict = {
  visible: true,
  title: 'Main character energy.',
  reaction: 'This is an animation preview. Your actual outfit gets its own reaction from Gemini.',
  tip: 'Start your camera. Gemini will react to your outfit automatically.',
  score: 9,
  palette: 'lime',
  scene: 'galaxy',
  energy: 3,
  occasion: 'Everyday',
  formats: ['glints', 'prisms', 'stickers'],
  effects: [
    { emoji: '👑', anchor: 'head', animation: 'halo' },
    { emoji: '🔥', anchor: 'shoulders', animation: 'orbit' },
    { emoji: '✨', anchor: 'body', animation: 'burst' },
    { emoji: '💎', anchor: 'hips', animation: 'float' },
  ],
};

const sceneEmojis = {
  galaxy: ['🪐', '🌟', '🚀', '💫'], inferno: ['🔥', '🐉', '❤️‍🔥', '💥'],
  electric: ['⚡', '🧊', '💎', '💥'], butterflies: ['🦋', '🌸', '🌺', '🫧'],
  disco: ['🪩', '🎵', '🌈', '✨'], vortex: ['🌀', '💎', '🧿', '☄️'],
};
export function scenePreview(scene) {
  const selection = sceneEmojis[scene] || sceneEmojis.galaxy;
  const formats = { galaxy: ['glints', 'prisms', 'stickers'], inferno: ['flames', 'glints', 'stickers'], electric: ['trails', 'glints', 'prisms'], butterflies: ['wings', 'glints', 'stickers'], disco: ['confetti', 'letters', 'glints'], vortex: ['trails', 'letters', 'prisms'] }[scene];
  return { ...previewVerdict, scene, formats, effects: selection.map((emoji, i) => ({ emoji, anchor: ['head', 'shoulders', 'body', 'hips'][i], animation: ['halo', 'spiral', 'burst', 'orbit'][i] })) };
}
