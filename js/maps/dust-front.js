// DUST FRONT — original desert bomb-defusal layout.
// Each character is one 2 m x 2 m cell. North is the top row.
//   #  wall (5 m)          =  low wall (1 m, jumpable cover)
//   .  sand   ,  paving    :  interior floor (gets a roof)
//   1-4 solid walkable block, height = digit * 0.5 m (stairs / platforms)
//   c  crate   C  large crate   k  stacked crates
//   t  attacker spawn   d  defender spawn   A / B  bomb site floor
export const DUST_FRONT = {
  id: 'dust-front',
  name: 'DUST FRONT',
  available: true,
  desc: 'Sun-baked desert town. Tunnels to B, a paved mid plaza with a sniper deck, and a long eastern lane to A.',
  rows: [
    '########################################',
    '#.........#..............#.............#',
    '#.BBBBB...#....dddddd....#..AAAAA...33.#',
    '#.BBBBB........dddddd....#..AAAAA...33.#',
    '#.BBBBB..c...............#..AAAAA...2..#',
    '#.BBBBB...#..k........c..#..AAAAA...1..#',
    '#......k..#...............k............#',
    '#.c.......#......==..............c.....#',
    '#.........#..............#.............#',
    '###..##########..####..#######..###..###',
    '#:::::::::#,,,,,,,,,,,,,,#.............#',
    '#:::::::::#,,,c,,,,,,,,,,#..........c..#',
    '#::####:::#,,,,,,,,,k,,,,#..#####......#',
    '#::####:::#,,,,,,,,,,,,,,...#####......#',
    '#::####:::#,,,,,,,,,,,,,,...#####..==..#',
    '#::####::::,,,,,#33321,,,#..#####......#',
    '#::####::::,,,,,#333,,,,,#..#####......#',
    '#::####:::#,,,,,,,,,,,,,,#..#####...k..#',
    '#:::::::::#,,c,,,,,,,,=,,#.............#',
    '#:::::::::#,,,,,,,,,,,=,,#....c........#',
    '#:::::::::#,,,,,,k,,,,,,,#.............#',
    '#:::::::::#,,,,,,,,,,,,,,#.............#',
    '######..#####..######..#########..######',
    '#.........#..............#.............#',
    '#.........#..............#.............#',
    '#..c......#.....c........#......k......#',
    '#........................#.............#',
    '#..###.........tttttt..................#',
    '#.........#....tttttt..................#',
    '#.........#..............#.............#',
    '#.........#..............#.............#',
    '########################################'
  ],
  // callout zones: [col0,row0,col1,row1,name] in cells (inclusive)
  zones: [
    [1, 1, 9, 8, 'B SITE'], [11, 1, 24, 8, 'DEFENDER SPAWN'], [26, 1, 38, 8, 'A SITE'],
    [1, 10, 10, 21, 'TUNNELS'], [11, 10, 24, 21, 'MID PLAZA'], [25, 10, 38, 21, 'LONG'],
    [1, 23, 9, 30, 'WEST YARD'], [10, 23, 24, 30, 'ATTACKER SPAWN'], [25, 23, 38, 30, 'EAST YARD']
  ],
  theme: {
    wall: 'sandstone', floor: 'sand', paving: 'paving', interior: 'concrete',
    block: 'stone', crate: 'crate', ceiling: 'plaster',
    sunDir: [0.45, 0.8, 0.35],
    sunColor: [0.66, 0.6, 0.48],
    ambient: [0.52, 0.53, 0.58],
    zenith: [0.30, 0.52, 0.80],
    horizon: [0.84, 0.76, 0.62],
    fogDensity: 0.007
  }
};
