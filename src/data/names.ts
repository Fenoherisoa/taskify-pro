// Realistic French first and last names pool for account generation
export const FIRST_NAMES = [
  'Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas', 'Antoine', 'Romain',
  'Guillaume', 'Clément', 'Hugo', 'Valentin', 'Mathieu', 'Florian', 'Adrien', 'Quentin',
  'Benjamin', 'Pierre', 'Louis', 'Arthur', 'Paul', 'Théo', 'Baptiste', 'Gabriel',
  'Camille', 'Emma', 'Léa', 'Chloé', 'Manon', 'Inès', 'Sarah', 'Laura',
  'Marine', 'Juliette', 'Lucie', 'Clara', 'Marie', 'Anaïs', 'Pauline', 'Océane'
];

export const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
  'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Andre', 'Lefevre',
  'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Martinez', 'Legrand', 'Garnier',
  'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller', 'Henry', 'Roussel', 'Nicolas'
];

export function generateRandomName(): { firstName: string; lastName: string } {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { firstName, lastName };
}
