// Datos de ejemplo para que cada equipo tenga algo que pintar desde el primer día.

export const SAMPLE_BOOKS = [
  { isbn: '978-0132350884', titulo: 'Clean Code', autor: 'Robert C. Martin', categoria: 'Software', stockTotal: 3 },
  { isbn: '978-0201616224', titulo: 'The Pragmatic Programmer', autor: 'Andrew Hunt, David Thomas', categoria: 'Software', stockTotal: 2 },
  { isbn: '978-0201633610', titulo: 'Design Patterns', autor: 'Gamma, Helm, Johnson, Vlissides', categoria: 'Software', stockTotal: 2 },
  { isbn: '978-0134685991', titulo: 'Effective Java', autor: 'Joshua Bloch', categoria: 'Software', stockTotal: 1 },
  { isbn: '978-1491950357', titulo: 'Building Microservices', autor: 'Sam Newman', categoria: 'Software', stockTotal: 2 },
  { isbn: '978-1593279509', titulo: 'Eloquent JavaScript', autor: 'Marijn Haverbeke', categoria: 'Programación Web', stockTotal: 4 },
  { isbn: '978-1098139742', titulo: 'Learning React', autor: 'Eve Porcello, Alex Banks', categoria: 'Programación Web', stockTotal: 3 },
  { isbn: '978-0133594140', titulo: 'Computer Networking: A Top-Down Approach', autor: 'Kurose, Ross', categoria: 'Redes', stockTotal: 2 },
  { isbn: '978-0132126953', titulo: 'Computer Networks', autor: 'Andrew S. Tanenbaum', categoria: 'Redes', stockTotal: 1 },
  { isbn: '978-0073523323', titulo: 'Database System Concepts', autor: 'Silberschatz, Korth, Sudarshan', categoria: 'Bases de Datos', stockTotal: 2 },
  { isbn: '978-1491954461', titulo: 'MongoDB: The Definitive Guide', autor: 'Shannon Bradshaw', categoria: 'Bases de Datos', stockTotal: 2 },
  { isbn: '978-0262033848', titulo: 'Introduction to Algorithms', autor: 'Cormen, Leiserson, Rivest, Stein', categoria: 'Matemáticas', stockTotal: 1 },
  { isbn: '978-0073383095', titulo: 'Matemáticas Discretas y sus Aplicaciones', autor: 'Kenneth H. Rosen', categoria: 'Matemáticas', stockTotal: 3 },
  { isbn: '978-0307474728', titulo: 'Cien años de soledad', autor: 'Gabriel García Márquez', categoria: 'Literatura', stockTotal: 2 },
  { isbn: '978-6070726000', titulo: 'Pedro Páramo', autor: 'Juan Rulfo', categoria: 'Literatura', stockTotal: 0 },
];

export const SAMPLE_SPORT_ITEMS = [
  { codigo: 'DEP-01', nombre: 'Balón Fútbol #5', deporte: 'Fútbol', estadoFisico: 'BUENO', cantidadTotal: 8 },
  { codigo: 'DEP-02', nombre: 'Conos de entrenamiento (juego de 10)', deporte: 'Fútbol', estadoFisico: 'NUEVO', cantidadTotal: 4 },
  { codigo: 'DEP-03', nombre: 'Petos de colores', deporte: 'Fútbol', estadoFisico: 'DESGASTADO', cantidadTotal: 20 },
  { codigo: 'DEP-04', nombre: 'Balón Básquetbol #7', deporte: 'Básquetbol', estadoFisico: 'BUENO', cantidadTotal: 6 },
  { codigo: 'DEP-05', nombre: 'Balón Básquetbol #6', deporte: 'Básquetbol', estadoFisico: 'NUEVO', cantidadTotal: 4 },
  { codigo: 'DEP-06', nombre: 'Balón Voleibol', deporte: 'Voleibol', estadoFisico: 'BUENO', cantidadTotal: 6 },
  { codigo: 'DEP-07', nombre: 'Red de Voleibol', deporte: 'Voleibol', estadoFisico: 'BUENO', cantidadTotal: 2 },
  { codigo: 'DEP-08', nombre: 'Bate de aluminio', deporte: 'Béisbol', estadoFisico: 'DESGASTADO', cantidadTotal: 3 },
  { codigo: 'DEP-09', nombre: 'Guante de béisbol', deporte: 'Béisbol', estadoFisico: 'BUENO', cantidadTotal: 10 },
  { codigo: 'DEP-10', nombre: 'Raqueta de tenis de mesa', deporte: 'Tenis de mesa', estadoFisico: 'NUEVO', cantidadTotal: 8 },
  { codigo: 'DEP-11', nombre: 'Cronómetro digital', deporte: 'Atletismo', estadoFisico: 'BUENO', cantidadTotal: 3 },
  { codigo: 'DEP-12', nombre: 'Silbato', deporte: 'Atletismo', estadoFisico: 'NUEVO', cantidadTotal: 0 },
];

const LABS = [
  { laboratorio: 'Lab-A', prefijo: 'A', especificaciones: 'Core i7 12va, 16GB RAM, SSD 512GB' },
  { laboratorio: 'Lab-B', prefijo: 'B', especificaciones: 'Core i5 11va, 8GB RAM, SSD 256GB' },
  { laboratorio: 'Redes', prefijo: 'R', especificaciones: 'Ryzen 5 5600G, 16GB RAM, SSD 512GB, 2 NIC' },
];

export function sampleComputers() {
  const pcs = [];
  for (const lab of LABS) {
    for (let n = 1; n <= 8; n++) {
      pcs.push({
        numeroInventario: `UTR-PC-${lab.prefijo}${String(n).padStart(2, '0')}`,
        laboratorio: lab.laboratorio,
        especificaciones: lab.especificaciones,
        perifericosIncluidos: ['Monitor', 'Teclado', 'Mouse'],
        // Una PC por laboratorio en mantenimiento para que se vea el color amarillo
        estatus: n === 8 ? 'MANTENIMIENTO' : 'DISPONIBLE',
        ultimoReporteFalla: n === 8 ? 'Fuente de poder dañada' : null,
      });
    }
  }
  return pcs;
}

export const SAMPLE_EQUIPMENT = [
  { tipo: 'Proyector', numeroSerie: 'EPS-LA-001', laboratorio: 'Lab-A', descripcion: 'Epson PowerLite' },
  { tipo: 'Proyector', numeroSerie: 'EPS-LB-001', laboratorio: 'Lab-B', descripcion: 'Epson PowerLite' },
  { tipo: 'Cable HDMI', numeroSerie: 'HDMI-LA-001', laboratorio: 'Lab-A', descripcion: '3 metros' },
  { tipo: 'Cable HDMI', numeroSerie: 'HDMI-LB-001', laboratorio: 'Lab-B', descripcion: '3 metros' },
  { tipo: 'Switch', numeroSerie: 'CSC-RD-001', laboratorio: 'Redes', descripcion: 'Cisco Catalyst 2960, 24 puertos' },
  { tipo: 'Switch', numeroSerie: 'CSC-RD-002', laboratorio: 'Redes', descripcion: 'Cisco Catalyst 2960, 24 puertos', estatus: 'MANTENIMIENTO' },
];
