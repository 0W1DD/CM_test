import { useEffect, useRef } from "react";
import { LOCATIONS, locationOf } from "~/lib/locations";

/** Tiny, static pixel decorations; no images, animation, or network requests. */
export function LocationArt({ locationId }: { locationId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    const ctx = context;
    const location = locationOf(locationId);
    const index = LOCATIONS.findIndex((item) => item.id === location.id);
    function r(x: number, y: number, w: number, h: number, c: string) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    }
    function tree(x: number, y: number, snow = false) {
      r(x + 12, y + 33, 5, 8, "#79502f");
      for (let i = 0; i < 4; i++) {
        r(
          x + 12 - i * 4,
          y + i * 8,
          5 + i * 8,
          10,
          snow ? "#426e66" : "#315943",
        );
        r(
          x + 12 - i * 4,
          y + i * 8,
          5 + i * 8,
          2,
          snow ? "#d8e6df" : "#5d8052",
        );
      }
      if (!snow) {
        r(x + 13, y - 5, 3, 8, "#f4cf65");
        r(x + 10, y - 2, 9, 2, "#f4cf65");
        (
          [
            [12, 9],
            [7, 19],
            [22, 27],
            [11, 30],
          ] as const
        ).forEach(([a, b]) => r(x + a, y + b, 3, 3, "#d96742"));
      }
    }
    function garland() {
      for (let i = 0; i < 19; i++) {
        const y = 8 + Math.round(Math.sin((i / 18) * Math.PI) * 11);
        r(43 + i * 7, y, 9, 3, "#365b3b");
        if (i % 3 === 0)
          r(47 + i * 7, y + 3, 2, 4, i % 2 ? "#dba748" : "#b94130");
      }
    }
    function draw() {
      const room = { trim: location.accent };
      ctx.clearRect(0, 0, 210, 74);
      r(0, 70, 210, 4, room.trim);
      if (index === 0) {
        garland();
        tree(78, 29);
        r(80, 65, 12, 7, "#ab4634");
        r(85, 65, 2, 7, "#edd493");
        r(96, 63, 10, 9, "#b69457");
        r(100, 63, 2, 9, "#eee0a4");
        r(150, 25, 44, 45, "#754029");
        r(147, 24, 50, 6, "#593722");
        r(153, 31, 38, 36, "#b17a4a");
        for (let row = 0; row < 4; row++)
          for (let col = 0; col < 3; col++)
            r(
              155 + col * 12 + (row % 2 ? 2 : 0),
              33 + row * 8,
              9,
              2,
              "#855536",
            );
        r(162, 42, 22, 27, "#34251f");
        r(166, 57, 14, 11, "#d84e1c");
        r(170, 49, 6, 19, "#e87720");
        r(168, 60, 10, 8, "#ffb52b");
        r(172, 57, 4, 11, "#ffe19a");
        r(146, 69, 52, 3, "#55351f");
        r(128, 56, 13, 14, "#593c2b");
        r(126, 53, 17, 4, "#8f6339");
        r(134, 42, 2, 12, "#d5ac61");
        r(130, 39, 7, 4, "#d5ac61");
        r(125, 36, 12, 3, "#e1bc72");
      }
      if (index === 1) {
        r(82, 19, 106, 3, "#d6b68a");
        for (let x = 90; x < 180; x += 24) {
          r(x, 22, 2, 12, "#44362c");
          r(x - 5, 33, 12, 12, x % 3 ? "#a5967b" : "#b86d43");
          r(x - 3, 35, 8, 8, "#75674f");
        }
        r(127, 56, 67, 14, "#5b6255");
        r(124, 53, 73, 4, "#d3c7a0");
        r(134, 60, 21, 7, "#343c35");
        r(161, 60, 23, 7, "#343c35");
        r(145, 43, 32, 10, "#373d36");
        r(141, 43, 4, 3, "#b0a88d");
        r(177, 43, 4, 3, "#b0a88d");
        r(145, 41, 32, 2, "#b0a88d");
        r(150, 39, 21, 2, "#bf8656");
        r(152, 52, 4, 2, "#63b5d1");
        r(165, 52, 4, 2, "#63b5d1");
        r(154, 28, 2, 8, "#ddc8a1");
        r(162, 24, 2, 11, "#ddc8a1");
        r(170, 29, 2, 7, "#ddc8a1");
        r(84, 58, 20, 12, "#b98a55");
      }
      if (index === 2) {
        r(143, 13, 51, 57, "#543d2d");
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 7; col++) {
            const h = 10 + ((col * 3 + row) % 6);
            const x = 147 + col * 6,
              y = 17 + row * 17 + 15 - h;
            r(
              x,
              y,
              4,
              h,
              ["#b07a56", "#8f9c74", "#d0ba8a", "#6d8282"][col % 4] ??
                "#b07a56",
            );
            r(x, y + 3, 4, 1, "#decdaa");
          }
          r(145, 32 + row * 17, 47, 3, "#957249");
        }
        r(77, 62, 58, 4, "#9b7b50");
        r(82, 66, 4, 7, "#554330");
        r(126, 66, 4, 7, "#554330");
        r(88, 44, 2, 18, "#bca669");
        r(80, 42, 20, 3, "#d6be77");
        r(84, 34, 12, 8, "#7a9b73");
        r(103, 57, 11, 5, "#eee1ba");
        r(115, 57, 11, 5, "#d1c49e");
        r(114, 58, 1, 5, "#80674d");
      }
      if (index === 3) {
        for (let i = 0; i < 15; i++)
          r(60 + ((i * 37) % 145), 7 + ((i * 19) % 50), 1, 2, "#cedfd8");
        r(65, 64, 140, 6, "#dce8dc");
        tree(84, 25, true);
        for (let x = 125; x < 200; x += 13) r(x, 52, 3, 18, "#a8b9ab");
        r(122, 57, 79, 2, "#c7d7c8");
        r(173, 22, 3, 45, "#283c3d");
        r(169, 20, 11, 14, "#c3a069");
        r(171, 23, 7, 9, "#fce3a0");
        r(167, 18, 15, 2, "#233b3e");
        r(170, 15, 9, 3, "#233b3e");
      }
      if (index === 4) {
        for (let i = 0; i < 12; i++) {
          r(76 + i * 5, 3 + i * 3, 7, 5, "#463a40");
          r(202 - i * 5, 3 + i * 3, 7, 5, "#463a40");
        }
        r(132, 28, 22, 24, "#302f45");
        r(127, 33, 32, 14, "#302f45");
        r(130, 34, 26, 12, "#8da5ad");
        r(135, 29, 16, 22, "#8da5ad");
        r(142, 28, 2, 24, "#524449");
        r(130, 39, 26, 2, "#524449");
        r(149, 33, 2, 2, "#f1dab0");
        r(166, 53, 29, 17, "#876948");
        r(165, 51, 31, 4, "#a38962");
        r(180, 55, 3, 5, "#e0c68f");
        r(92, 60, 23, 10, "#9c805c");
        r(95, 56, 18, 4, "#ad9871");
        r(117, 60, 10, 10, "#5e4c50");
      }
    }
    draw();
  }, [locationId]);
  return (
    <canvas
      ref={ref}
      width={210}
      height={74}
      className="location-art"
      aria-hidden="true"
    />
  );
}
