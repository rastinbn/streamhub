/**
 * Shared category shapes used by both the API (responses) and the web
 * client. Keep in sync with the Prisma `Category` model.
 */

export interface CategoryPublic {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
  thumbnail?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  thumbnail?: string;
}
