import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "react-email";

/** Template React Email de referência para o preview (`npm run email:dev`). */
export default function LeadsStarter() {
  return (
    <Html>
      <Head />
      <Preview>Olá {"{{nome}}"}</Preview>
      <Body style={{ backgroundColor: "#fafafa", fontFamily: "sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "24px 0", maxWidth: 560 }}>
          <Heading as="h2">Contato inicial</Heading>
          <Text>Olá {"{{nome}}"}, vi a {"{{empresa}}"} e gostaria de conversar.</Text>
          <Text>
            <Link href="https://example.com">Saiba mais</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
