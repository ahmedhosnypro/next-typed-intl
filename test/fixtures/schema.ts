export interface TestMessages {
  nav: { home: string; about: string };
  greeting: (name: string) => string;
  itemCount: (count: number) => string;
}

export interface AuthLabels {
  login: string;
  logout: string;
  welcomeBack: (name: string) => string;
}

export const enMessages: TestMessages = {
  nav: { home: "Home", about: "About" },
  greeting: (name) => `Hello, ${name}!`,
  itemCount: (count) => (count === 1 ? "1 item" : `${count} items`),
};

export const arMessages: TestMessages = {
  nav: { home: "الرئيسية", about: "حول" },
  greeting: (name) => `مرحباً، ${name}!`,
  itemCount: (count) => {
    if (count === 0) return "لا عناصر";
    if (count === 1) return "عنصر واحد";
    if (count === 2) return "عنصران";
    if (count >= 3 && count <= 10) return `${count} عناصر`;
    return `${count} عنصراً`;
  },
};

export const enAuth: AuthLabels = {
  login: "Log in",
  logout: "Log out",
  welcomeBack: (name) => `Welcome back, ${name}!`,
};

export const arAuth: AuthLabels = {
  login: "تسجيل الدخول",
  logout: "تسجيل الخروج",
  welcomeBack: (name) => `مرحباً بعودتك، ${name}!`,
};
