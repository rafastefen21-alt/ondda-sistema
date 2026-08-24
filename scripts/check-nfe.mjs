import pg from "pg";

const CH = "35260665922507000148550010000000351004972153";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// 1. Produto(s) da nota que travou (por accessKey)
const byKey = await client.query(
  `SELECT p.name, p.cfop, p."icmsCsosn",
          p."stBcRetidoUnit", p."stAliquotaFinal", p."stIcmsRetidoUnit"
     FROM "Invoice" i
     JOIN "OrderItem" oi ON oi."orderId" = i."orderId"
     JOIN "Product" p    ON p.id = oi."productId"
    WHERE i."accessKey" = $1`,
  [CH],
);

console.log(`=== Nota ${CH} ===`);
if (byKey.rows.length === 0) {
  console.log("(nenhuma invoice com esse accessKey — vendo as últimas com ERRO)\n");
  const errs = await client.query(
    `SELECT i.id, i.number, p.name, p.cfop, p."icmsCsosn"
       FROM "Invoice" i
       JOIN "OrderItem" oi ON oi."orderId" = i."orderId"
       JOIN "Product" p    ON p.id = oi."productId"
      WHERE i.status = 'ERRO'
      ORDER BY i."createdAt" DESC
      LIMIT 15`,
  );
  for (const r of errs.rows) {
    console.log(`  nº ${r.number ?? "-"} | ${r.name} | CFOP ${r.cfop} | CSOSN ${r.icmsCsosn}`);
  }
} else {
  for (const r of byKey.rows) {
    console.log(`  ${r.name}`);
    console.log(`    CFOP: ${r.cfop} | CSOSN: ${r.icmsCsosn}`);
    console.log(`    ST: BC=${r.stBcRetidoUnit} aliq=${r.stAliquotaFinal} retido=${r.stIcmsRetidoUnit}`);
  }
}

// 2. Panorama de produtos por CFOP/CSOSN
console.log("\n=== Produtos por CFOP / CSOSN ===");
const grp = await client.query(
  `SELECT cfop, "icmsCsosn" AS csosn, count(*)::int AS n
     FROM "Product"
    GROUP BY cfop, "icmsCsosn"
    ORDER BY cfop`,
);
for (const r of grp.rows) {
  console.log(`  CFOP ${r.cfop ?? "(nulo)"} | CSOSN ${r.csosn ?? "(nulo)"} → ${r.n} produto(s)`);
}

await client.end();
