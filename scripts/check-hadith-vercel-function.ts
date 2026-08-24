import http from "node:http";
import app from "../api/hadith/[...path]";

const server = http.createServer(app);

await new Promise<void>((resolve) => server.listen(4180, "127.0.0.1", resolve));

try {
  const allowedResponse = await fetch("http://127.0.0.1:4180/api/hadith/books", {
    headers: { Origin: "https://sakina-design-transplant.vercel.app" },
  });
  const allowedBody = await allowedResponse.json();

  const blockedResponse = await fetch("http://127.0.0.1:4180/api/hadith/books", {
    headers: { Origin: "https://untrusted.example" },
  });

  console.log(
    JSON.stringify(
      {
        allowedStatus: allowedResponse.status,
        booksEndpointWorks: allowedResponse.status === 200 && allowedBody.success === true,
        booksCount: Array.isArray(allowedBody.books) ? allowedBody.books.length : 0,
        blockedOriginStatus: blockedResponse.status,
        blockedOriginRejected: blockedResponse.status >= 400,
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
