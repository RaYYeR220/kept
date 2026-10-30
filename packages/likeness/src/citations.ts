export type CitationId =
  | "watanabe2019"
  | "nihHairLoss"
  | "acsWigs"
  | "nciSkinNails"
  | "acsNails"
  | "euFragranceAllergens"
  | "youcamTerms";

export type Citation = { label: string; url: string };

export const CITATIONS: Record<CitationId, Citation> = {
  watanabe2019: {
    label:
      "Watanabe T. et al. A multicenter survey of temporal changes in chemotherapy-induced hair loss in breast cancer patients. PLoS One, 2019 (n = 1,478).",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6326423/",
  },
  nihHairLoss: {
    label: "InformedHealth.org (NIH Bookshelf). Overview: Hair loss in chemotherapy, 2023.",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK547552/",
  },
  acsWigs: {
    label: "American Cancer Society. Wigs for hair loss: planning ahead and choosing a colour, 2024.",
    url: "https://www.cancer.org/cancer/side-effects/hair-skin-nails/hair-loss/choosing-and-wearing-wig.html",
  },
  nciSkinNails: {
    label: "National Cancer Institute. Skin and nail changes during cancer treatment, reviewed 2022.",
    url: "https://www.cancer.gov/about-cancer/treatment/side-effects/skin-nail-changes",
  },
  acsNails: {
    label: "American Cancer Society. Nail changes: tips for preventing and managing, 2024.",
    url: "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/nail-changes.html",
  },
  euFragranceAllergens: {
    label: "EU Cosmetics Regulation (EC) 1223/2009, Annex III — fragrance allergens that must be labelled.",
    url: "https://eur-lex.europa.eu/eli/reg/2009/1223/oj",
  },
  youcamTerms: {
    label: "YouCam API Terms of Service.",
    url: "https://www.makeupar.com/perfectbeauty/youcam/terms-of-service-api",
  },
};
