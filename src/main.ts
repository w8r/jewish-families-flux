import "./style.css";
//import * as d3 from "d3";
import * as Plot from "@observablehq/plot";
import * as topojson from "topojson";
import type { FeatureCollection, Polygon } from "geojson";

type Place = {
  name: string;
  latitude: number | null; // Use null for places without coordinates
  longitude: number | null; // Use null for places without coordinates
};

type Migration = {
  from: number;
  to: number;
  year?: number | string;
  core?: boolean;
  generation: -3 | -2 | -1 | 0 | 1;
};

type Family = {
  name: string;
  places: Place[];
  migrations: Migration[];
};

type FamilyData = {
  families: Family[];
};

const migrationToArrowData = (migration: Migration, places: Place[]) => {
  const { from, to } = migration;
  const start = places[from];
  const end = places[to];
  return [
    {
      x1: start.longitude!,
      y1: start.latitude!,
      x2: end.longitude!,
      y2: end.latitude!,
    },
    {
      x1: start.longitude!,
      y1: start.latitude!,
      x2: end.longitude!,
      y2: end.latitude!,
    },
  ];
};

const file = await fetch("countries-50m.json");
const world = (await file.json()) as TopoJSON.Topology;
const data = (await fetch("families.json").then((d) => d.json())) as FamilyData;
console.log(data);

const generationColor = new Map([
  [-3, "#007F00"],
  [-2, "#007F00"],
  [-1, "#007FFF"],
  [0, "#7F0000"],
  [1, "#000000"],
]);

const generationName = new Map([
  [-3, "great-great-grandparents"],
  [-2, "great-grandparents"],
  [-1, "grandparents"],
  [0, "parents"],
  [1, "core family"],
]);

const countries = topojson.feature(
  world,
  world.objects.countries
) as unknown as FeatureCollection;
const land = topojson.feature(world, world.objects.land);

const bboxToGeoJSONGeometry = (bbox: number[][]): Polygon => {
  return {
    type: "Polygon",
    coordinates: [
      [
        bbox[0],
        [bbox[0][0], bbox[1][1]],
        bbox[1],
        [bbox[1][0], bbox[0][1]],
        bbox[0],
      ],
    ],
  };
};

let plot: SVGSVGElement | HTMLElement;
const render = (data: FamilyData) => {
  const bbox = data.families.reduce(
    (acc, family) => {
      const { places } = family;
      const longitudes = places
        .map((place) => place.longitude!)
        .filter(Boolean);
      const latitudes = places.map((place) => place.latitude!).filter(Boolean);
      const minLongitude = Math.min(...longitudes);
      const maxLongitude = Math.max(...longitudes);
      const minLatitude = Math.min(...latitudes);
      const maxLatitude = Math.max(...latitudes);

      return [
        [Math.min(acc[0][0], minLongitude), Math.min(acc[0][1], minLatitude)],
        [Math.max(acc[1][0], maxLongitude), Math.max(acc[1][1], maxLatitude)],
      ];
    },
    [
      [Infinity, Infinity],
      [-Infinity, -Infinity],
    ]
  );
  console.log(bbox);

  if (plot) plot.remove();
  plot = Plot.plot({
    width: document.body.clientWidth,
    height: document.body.clientHeight,
    projection: {
      type: "equirectangular",
      clip: true,
      domain: {
        type: "Polygon",
        coordinates: [
          [
            [-40, -30],
            [-50, 60],
            [50, 60],
            [50, -30],
            [-50, -30],
          ],
        ],
      },
      //type: "equal-earth",
      //rotate: [0, 0],
      //domain: circle,
      //inset: 10,
    },
    marks: [
      Plot.geo(land, {
        fill: "#ddd",
      }),
      Plot.geo(countries, {
        stroke: "#aaa",
        strokeWidth: 0.5,
      }),
      data.families.map((family) => {
        const { places, migrations } = family;
        console.log(family);
        const arrows = migrations.map((migration) => {
          const { core, generation } = migration;
          const color = generationColor.get(core ? 1 : generation);
          const arrow = Plot.arrow(migrationToArrowData(migration, places), {
            bend: true,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeMiterlimit: 6,
            headLength: 8,
            headAngle: 30,
            strokeWidth: 2,
            x1: "x1",
            x2: "x2",
            y1: "y1",
            y2: "y2",
            stroke: color,
            sweep: "-x",
          });
          return arrow;
        });
        const texts = Plot.text(
          places.map((place) => {
            return {
              type: "Feature",
              properties: { name: place.name },
              geometry: {
                type: "Point",
                coordinates: [place.longitude!, place.latitude!],
              },
            };
          }),
          Plot.centroid({
            text: (d) => d.properties.name,
            //textAnchor: "start",
            frameAnchor: "left",
            dx: 6,
          })
        );
        // place marks on the map
        const dots = Plot.dot(places, {
          x: "longitude",
          y: "latitude",
          r: 4,
          stroke: "#444444",
          fill: "red",
          fillOpacity: 0.2,
        });
        const tips = migrations
          .filter((migration) => migration.year)
          .map((migration) => {
            const { year, from, to } = migration;
            const start = places[from];
            const end = places[to];
            const x1 = start.longitude!;
            const y1 = start.latitude!;
            const x2 = end.longitude!;
            const y2 = end.latitude!;

            const x = (x1 + x2) / 2;
            +(y1 - y2) * 0.15;
            const y = (y1 + y2) / 2;
            -(x1 - x2) * 0.15;
            return Plot.tip([year], {
              x,
              y,
              dy: -3,
              anchor: "bottom",
            });
          });
        return [[dots], ...arrows, [texts]];
      }),
    ],
  });
  const canvas = document.querySelector<HTMLDivElement>("#app")!;
  canvas.append(plot);
};

render(data);

const controls = document.querySelector<HTMLDivElement>("#controls")!;
controls.innerHTML += data.families
  .map((family, i) => {
    return `<div><label><input type="checkbox" checked family-id="${i}" />${family.name}</label></div>`;
  })
  .join("");

// render colors legend
controls.innerHTML +=
  `<div class="legend">` +
  Array.from(generationColor.keys())
    .map((generation) => {
      const color = generationColor.get(generation);
      const name = generationName.get(generation);
      return `<div>
        <span class="legend--color" style="background-color: ${color}"></span>
        <span class="legend--label">${name}</span>
      </div>`;
    })
    .join("") +
  "</div>";

let timer: number;
controls.addEventListener("change", () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const checked = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type=checkbox]")
    )
      .filter((d) => d.checked)
      .map((d) => parseInt(d.getAttribute("family-id")!));
    const filteredData = {
      families: data.families.filter((_, i) => checked.includes(i)),
    };
    render(filteredData);
  }, 250);
});

// download button
controls.innerHTML += `<div class="controls">
  <button id="save">Download map</button>
</div>`;
document
  .querySelector<HTMLButtonElement>("#save")!
  .addEventListener("click", () => {
    const svg = document.querySelector<SVGSVGElement>("svg")!;
    const svgData = new XMLSerializer().serializeToString(svg);
    // save SVG as file
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // download SVG file
    link.download = "map.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
