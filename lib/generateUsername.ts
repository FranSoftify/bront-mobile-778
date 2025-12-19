const ADJECTIVES = [
  'Turquoise', 'Crimson', 'Golden', 'Azure', 'Emerald', 'Silver', 'Coral',
  'Violet', 'Amber', 'Jade', 'Ruby', 'Cobalt', 'Scarlet', 'Indigo', 'Copper',
  'Sapphire', 'Bronze', 'Ivory', 'Onyx', 'Pearl', 'Teal', 'Magenta', 'Cyan'
];

const NOUNS = [
  'Apple', 'Bear', 'Cloud', 'Dragon', 'Eagle', 'Fox', 'Glacier', 'Hawk',
  'Island', 'Jaguar', 'Knight', 'Lion', 'Mountain', 'Neptune', 'Orchid',
  'Phoenix', 'Quartz', 'Raven', 'Storm', 'Tiger', 'Unicorn', 'Viper', 'Wolf'
];

export const generateFunUsername = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  hash = Math.abs(hash);
  
  const adjIndex = hash % ADJECTIVES.length;
  const nounIndex = Math.floor(hash / ADJECTIVES.length) % NOUNS.length;
  const number = (hash % 99) + 1;
  
  return `${ADJECTIVES[adjIndex]}${NOUNS[nounIndex]}${number}`;
};

export const isValidDisplayName = (name?: string | null): boolean => {
  if (!name) return false;
  if (name.includes('@')) return false;
  if (name.includes('privaterelay')) return false;
  if (/^[a-z0-9]{8,}$/i.test(name) && !/[aeiou]{2,}/i.test(name)) return false;
  return true;
};
