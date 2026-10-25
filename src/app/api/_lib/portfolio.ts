// serialize مشترک نمونه‌کارها (استفاده در route و [id])
export interface PortfolioRow {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  visible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function serializePortfolioItem(it: PortfolioRow) {
  return {
    id: it.id,
    title: it.title,
    description: it.description,
    category: it.category,
    image: it.image,
    visible: it.visible,
    sortOrder: it.sortOrder,
    createdAt: it.createdAt.toISOString(),
    updatedAt: it.updatedAt.toISOString(),
  };
}
