import { redirect } from "next/navigation";

/** Rota antiga: envio foi dividido em disparos e templates. */
export default function EnvioRedirectPage() {
  redirect("/leads/disparos");
}
