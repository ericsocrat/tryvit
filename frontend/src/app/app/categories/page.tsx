import { redirect } from "next/navigation";

/** Categories are a Find capability; retain the established bookmark. */
export default function CategoriesPage() {
  redirect("/app/search?panel=categories");
}
