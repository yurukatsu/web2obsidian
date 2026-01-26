import { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@i18n/config";

// Custom render function that wraps components with providers
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  locale?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { locale = "en", ...options }: CustomRenderOptions = {}
) {
  // Set locale for testing
  i18n.changeLanguage(locale);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { renderWithProviders as render };
