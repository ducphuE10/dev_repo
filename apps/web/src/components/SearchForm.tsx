interface SearchFormProps {
  action?: string;
  initialCategory?: string;
  initialQuery?: string;
  initialSort?: "upvotes" | "newest";
  verifiedOnly?: boolean;
}

export const SearchForm = ({
  action = "/search",
  initialCategory = "",
  initialQuery = "",
  initialSort = "upvotes",
  verifiedOnly = false
}: SearchFormProps) => (
  <form action={action} className="search-form">
    <label className="search-form__field">
      <span className="sr-only">Search dupes</span>
      <input defaultValue={initialQuery} name="q" placeholder="Search by product, dupe, or brand" type="search" />
    </label>

    <label className="search-form__select">
      <span className="sr-only">Sort results</span>
      <select defaultValue={initialSort} name="sort">
        <option value="upvotes">Most loved</option>
        <option value="newest">Newest</option>
      </select>
    </label>

    <label className="search-form__toggle">
      <input defaultChecked={verifiedOnly} name="verified" type="checkbox" value="true" />
      Verified buys only
    </label>

    {initialCategory ? <input name="category" type="hidden" value={initialCategory} /> : null}

    <button type="submit">Search</button>
  </form>
);
