import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err?.response?.data?.error ??
      err?.response?.data?.message ??
      err?.message ??
      "Erro na requisição";
    return Promise.reject(new Error(typeof message === "string" ? message : JSON.stringify(message)));
  },
);
