import "dotenv/config";
import { getPoliticianPins } from "../src/lib/queries/politician-pins";

async function main() {
  const { pins } = await getPoliticianPins();
  const samples = {
    national: pins.find((p) => p.layer === "national"),
    metroGov: pins.find((p) => p.layer === "metroGov"),
    edu: pins.find((p) => p.layer === "edu"),
    localGov: pins.find((p) => p.layer === "localGov"),
  };
  for (const [k, p] of Object.entries(samples)) {
    if (!p) continue;
    console.log(
      `[${k}] name=${p.name}  positionTitle=${p.positionTitle}  districtName=${p.districtName}`,
    );
  }
}
main();
