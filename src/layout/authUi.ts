import { createContext, useContext } from "react";

/** Cho phép mọi trang trong khung website mở hộp thoại đăng nhập. */
export const AuthUi = createContext<{ open: () => void }>({ open: () => {} });
export const useAuthUi = () => useContext(AuthUi);
