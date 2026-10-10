// Carga datos de demostración a través de la API real: usuarios, grafo de
// seguidores, publicaciones de los tres formatos, comentarios, reacciones y
// conversaciones (contactos y solicitudes). Así la app no se ve vacía.
//
//   node scripts/seed.mjs            # contra los servicios locales
//   node scripts/seed.mjs --force    # vuelve a sembrar aunque ya haya datos
//
// Variables opcionales: AUTH_URL, USERS_URL, POSTS_URL, CHAT_URL (por defecto
// http://localhost:3000..3003) y SEED_PASSWORD.
//
// Cuenta para explorar la app:  usuario "demo"  /  contraseña "Demo12345"
//
// El rate limiting de los servicios (p. ej. 5 registros por minuto) también
// aplica aquí: el script espera lo que pida el servidor y sigue. Para sembrar
// al instante, arranca los servicios con THROTTLE_DISABLED=true.

const URL = {
  auth: process.env.AUTH_URL ?? 'http://localhost:3000',
  users: process.env.USERS_URL ?? 'http://localhost:3001',
  posts: process.env.POSTS_URL ?? 'http://localhost:3002',
  chat: process.env.CHAT_URL ?? 'http://localhost:3003',
};
const PASSWORD = process.env.SEED_PASSWORD ?? 'Demo12345';
const FORCE = process.argv.includes('--force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(service, path, { method = 'GET', token, body } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(URL[service] + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body && JSON.stringify(body),
    });
    if (res.status === 429 && attempt <= 8) {
      const wait = Number(res.headers.get('retry-after')) || 15;
      console.log(`   … límite de peticiones, esperando ${wait + 1}s`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }
}

function must({ status, data }, ok, what) {
  if (!ok.includes(status)) {
    throw new Error(`${what}: HTTP ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------
const PEOPLE = [
  { key: 'demo', username: 'demo', firstName: 'Demo', lastName: 'PiensaYa', bio: 'Cuenta de demostración para explorar PiensaYa. Estudiante de Ingeniería de Software.' },
  { key: 'ana', username: 'ana_torres', firstName: 'Ana', lastName: 'Torres', bio: 'Matemáticas aplicadas. Escribo lo que me hubiera gustado leer antes de cada examen.' },
  { key: 'luis', username: 'luis_quispe', firstName: 'Luis', lastName: 'Quispe', bio: 'Backend, Linux y café. Aprendiendo sistemas distribuidos.' },
  { key: 'sofia', username: 'sofia_vega', firstName: 'Sofía', lastName: 'Vega', bio: 'Datos y SQL. Si hay una consulta lenta, probablemente falta un índice.' },
  { key: 'marco', username: 'marco_rojas', firstName: 'Marco', lastName: 'Rojas', bio: 'Arquitectura de software. Prefiero lo simple que funciona.' },
  { key: 'valeria', username: 'valeria_cruz', firstName: 'Valeria', lastName: 'Cruz', bio: 'Diseño de interfaces y accesibilidad.' },
  { key: 'diego', username: 'diego_paredes', firstName: 'Diego', lastName: 'Paredes', bio: 'Redes y seguridad. CTF los fines de semana.' },
  { key: 'camila', username: 'camila_diaz', firstName: 'Camila', lastName: 'Díaz', bio: 'Estadística y machine learning.' },
  { key: 'jorge', username: 'jorge_salas', firstName: 'Jorge', lastName: 'Salas', bio: 'Primer año, buscando compañeros para estudiar.' },
];

// quién sigue a quién (de ahí salen el feed y las sugerencias de "amigos de amigos")
const FOLLOWS = {
  demo: ['ana', 'luis', 'sofia'],
  ana: ['marco', 'valeria', 'demo'],
  luis: ['marco', 'diego', 'demo'],
  sofia: ['camila', 'ana'],
  marco: ['luis'],
  camila: ['demo', 'sofia'],
  valeria: ['ana'],
};

const POSTS = [
  { key: 'p-calculo', by: 'ana', type: 'POST', title: 'Cómo estudié Cálculo II sin morir en el intento', content: 'Lo que más me ayudó no fue memorizar fórmulas, sino entender de dónde salen. Antes de cada práctica hacía tres cosas: 1) resolvía a mano la demostración de la regla que iba a usar, 2) hacía los ejercicios sin mirar la solución y marcaba dónde me trababa, 3) explicaba en voz alta el ejercicio más difícil a alguien que no llevara el curso.\n\nSi no puedes explicarlo con palabras simples, todavía no lo entiendes. Las integrales por partes dejaron de asustarme el día que entendí que son la regla del producto al revés.\n\nSi estás en el mismo curso, cuéntame cuál tema se te hace más pesado. #calculo #estudio' },
  { key: 'p-git', by: 'luis', type: 'POST', title: 'Guía rápida de Git para trabajos en grupo', content: 'Tres reglas que nos ahorraron muchos dolores de cabeza en el proyecto del ciclo:\n\n1. Nadie trabaja directo en main. Cada cambio va en una rama corta y se integra con un pull request.\n2. Commits pequeños y con mensaje claro: "arregla el cálculo del promedio" es mejor que "cambios".\n3. Antes de empezar a trabajar, actualiza tu rama; antes de subir, vuelve a actualizarla. La mayoría de los conflictos nacen de saltarse esto.\n\nSi te equivocas, casi todo se puede deshacer. Aprende reflog y pierde el miedo. #programacion #git' },
  { key: 'p-sql', by: 'sofia', type: 'POST', title: 'Por qué tus consultas SQL son lentas (y cómo arreglarlo)', content: 'El 80% de las veces el problema es el mismo: la consulta recorre toda la tabla porque falta un índice en la columna por la que filtras.\n\nCómo revisarlo: antepón EXPLAIN a tu consulta y busca "Seq Scan" sobre una tabla grande. Crea un índice sobre la columna del WHERE o del JOIN y vuelve a medir.\n\nCuidado: un índice acelera las lecturas pero encarece las escrituras, así que no los pongas en todas partes. Mide antes y después. #datos #sql' },
  { key: 'p-micro', by: 'marco', type: 'POST', title: 'Microservicios: cuándo sí y cuándo no', content: 'Separar un sistema en servicios resuelve problemas de equipos y de escalado, pero a cambio compras latencia, fallos parciales y más cosas que desplegar.\n\nSi tu equipo es de dos personas y tu aplicación cabe en un servidor, un monolito bien organizado casi siempre gana. Los microservicios valen la pena cuando partes del sistema tienen ritmos de cambio o de carga muy distintos.\n\nPara aprender sí los recomiendo: te obligan a pensar en contratos, reintentos y consistencia eventual. #arquitectura #programacion' },
  { key: 'p-demo', by: 'demo', type: 'POST', title: 'Por qué construí PiensaYa', content: 'PiensaYa es un proyecto de portafolio para practicar arquitectura de software: cinco microservicios NestJS (auth, usuarios y seguidores, publicaciones, chat y feed), un frontend en Next.js y comunicación entre ellos por REST y por eventos.\n\nLo que más aprendí: el feed se arma al publicar (fan-out on write) y por eso leerlo es una sola consulta; los eventos pueden llegar en cualquier orden, así que borrar un post necesita una lápida; y las pruebas e2e encuentran bugs que las unitarias no ven.\n\nTodo el código y la documentación están en el repositorio. #arquitectura #programacion' },
  { key: 't-demo', by: 'demo', type: 'TWEET', content: 'Armando un grupo de estudio para el parcial de Cálculo II. ¿Quién se anima? #calculo #estudio' },
  { key: 't-pomodoro', by: 'ana', type: 'TWEET', content: 'Pomodoros de 25 minutos + 5 de descanso. Lo difícil no es empezar: es no abrir el celular en el descanso. #estudio' },
  { key: 't-regex', by: 'luis', type: 'TWEET', content: 'Si resuelves un problema con una expresión regular, ahora tienes dos problemas. Pero qué bien se siente cuando funciona. #programacion' },
  { key: 't-index', by: 'sofia', type: 'TWEET', content: 'Un índice en la columna correcta convirtió una consulta de 4 segundos en una de 20 milisegundos. #sql #datos' },
  { key: 't-contraste', by: 'valeria', type: 'TWEET', content: 'Revisa el contraste de tus colores: si cuesta leerlo en un celular al sol, cuesta para todos. #diseno #accesibilidad' },
  { key: 't-ctf', by: 'diego', type: 'TWEET', content: 'Primer CTF del semestre este sábado. Si quieres armar equipo, escríbeme. #seguridad' },
  { key: 't-pvalue', by: 'camila', type: 'TWEET', content: 'Un p-valor de 0.049 no es "significativo" y uno de 0.051 "no": es un continuo. Interpreta el efecto, no solo el umbral. #estadistica' },
  { key: 'o-notas', by: 'marco', type: 'OPINION', content: 'Opino que tomar apuntes a mano rinde más que pasarlos en limpio en la computadora. No por nostalgia: escribir lento te obliga a resumir, y resumir es estudiar. La excepción son los diagramas, esos mejor digitales. #estudio' },
  { key: 'o-tests', by: 'luis', type: 'OPINION', content: 'Los tests no son pérdida de tiempo, son la razón por la que puedes cambiar código sin miedo. Un proyecto sin pruebas funciona mientras nadie lo toca. #programacion #testing' },
  { key: 'o-ia', by: 'camila', type: 'OPINION', content: 'Usar IA para estudiar sirve si primero intentas tú y luego comparas. Si le pides la respuesta de entrada, solo aprendes a pedir respuestas. #estudio #ia' },
];

const COMMENTS = [
  ['p-demo', 'marco', 'Muy buen resumen. Lo de la lápida para los eventos fuera de orden es un detalle que casi nadie considera.'],
  ['p-demo', 'luis', 'Me gusta que el feed sea una sola lectura. ¿Probaste cuántos seguidores aguanta antes de que el fan-out duela?'],
  ['t-demo', 'ana', 'Yo me apunto, justo estaba buscando grupo.'],
  ['p-calculo', 'luis', 'Lo de explicárselo a otra persona funciona de verdad. Yo lo hago con mi hermano y no sabe nada del tema.'],
  ['p-calculo', 'demo', 'Gracias por compartirlo, me llevo lo de demostrar la regla antes de aplicarla.'],
  ['p-calculo', 'camila', 'Agrego: resolver exámenes de ciclos anteriores con cronómetro.'],
  ['p-git', 'ana', 'La regla 3 me habría salvado el trabajo final del ciclo pasado.'],
  ['p-git', 'sofia', 'Y un .gitignore desde el primer commit, que nadie suba su .env.'],
  ['p-sql', 'luis', 'EXPLAIN ANALYZE además de EXPLAIN te da los tiempos reales, muy útil.'],
  ['p-sql', 'demo', 'Buen recordatorio sobre el costo de los índices en escritura.'],
  ['p-micro', 'sofia', 'Coincido: primero el monolito, luego se separa lo que duele.'],
  ['p-micro', 'diego', '¿Cómo manejan la autenticación entre servicios? Me quedé con esa duda.'],
  ['t-pomodoro', 'demo', 'Yo dejo el celular en otro cuarto. Cambia todo.'],
  ['o-tests', 'marco', 'Más aún: los tests son documentación que no se desactualiza.'],
  ['o-notas', 'ana', 'Totalmente. Lo digital solo para diagramas.'],
];

const REACTIONS = [
  ['p-demo', { marco: 'INTERESANTE', luis: 'LIKE', ana: 'LIKE', sofia: 'INTERESANTE' }],
  ['t-demo', { ana: 'LIKE', luis: 'FELIZ' }],
  ['p-calculo', { luis: 'LIKE', demo: 'INTERESANTE', camila: 'LIKE', sofia: 'FELIZ', marco: 'LIKE' }],
  ['p-git', { ana: 'LIKE', demo: 'LIKE', marco: 'INTERESANTE', sofia: 'LIKE' }],
  ['p-sql', { luis: 'INTERESANTE', ana: 'LIKE', demo: 'INTERESANTE' }],
  ['p-micro', { sofia: 'LIKE', luis: 'INTERESANTE', diego: 'LIKE' }],
  ['t-pomodoro', { demo: 'FELIZ', luis: 'LIKE', valeria: 'LIKE' }],
  ['t-regex', { ana: 'FELIZ', sofia: 'FELIZ', demo: 'FELIZ', marco: 'LIKE' }],
  ['t-index', { luis: 'LIKE', demo: 'LIKE' }],
  ['t-contraste', { ana: 'INTERESANTE', demo: 'LIKE' }],
  ['t-ctf', { luis: 'LIKE' }],
  ['t-pvalue', { ana: 'INTERESANTE', sofia: 'LIKE' }],
  ['o-notas', { ana: 'LIKE', luis: 'DISLIKE', demo: 'INTERESANTE' }],
  ['o-tests', { marco: 'LIKE', sofia: 'LIKE', demo: 'LIKE', camila: 'LIKE' }],
  ['o-ia', { demo: 'INTERESANTE', ana: 'LIKE', jorge: 'LIKE' }],
];

// [de, para, texto]. demo<->ana y demo<->luis son contactos (los sigue demo);
// jorge y diego le escriben sin que demo los siga: aparecen en "Solicitudes".
const CHATS = [
  ['demo', 'ana', 'Hola Ana, leí tu artículo de Cálculo II, me sirvió mucho.'],
  ['ana', 'demo', '¡Qué bueno! Si quieres armamos un grupo de estudio para el parcial.'],
  ['demo', 'ana', 'Me encantaría. ¿El jueves después de clases?'],
  ['ana', 'demo', 'Dale, nos vemos en la biblioteca a las 4. Llevo los ejercicios de integrales.'],
  ['luis', 'demo', '¿Viste el apunte de Git? Te pasé una plantilla de .gitignore.'],
  ['demo', 'luis', 'Sí, gracias. La uso en el proyecto del ciclo.'],
  ['luis', 'demo', 'Cuando termines, pásame el enlace y le echo un vistazo al código.'],
  ['jorge', 'demo', 'Hola, soy de primer año. ¿Me recomiendas algún curso para aprender Git?'],
  ['jorge', 'demo', 'Perdona la molestia, es que me cuesta con los conflictos de merge.'],
  ['diego', 'demo', 'Hola, vi tu perfil. ¿Te interesa armar equipo para un CTF este sábado?'],
];

// ---------------------------------------------------------------------------
async function main() {
  const who = {}; // key -> { id, token }

  console.log('Usuarios');
  for (const p of PEOPLE) {
    const body = { username: p.username, password: PASSWORD, firstName: p.firstName, lastName: p.lastName };
    // Login primero: en una segunda corrida los usuarios ya existen y así no
    // se gasta el cupo (más estricto) de registros.
    let res = await call('auth', '/auth/login', { method: 'POST', body: { username: p.username, password: PASSWORD } });
    if (res.status === 401) res = await call('auth', '/auth/register', { method: 'POST', body });
    const auth = must(res, [200, 201], `acceso de ${p.username}`);
    who[p.key] = { id: auth.userId, token: auth.accessToken };
    console.log(`   ✓ @${p.username}`);
  }

  // El perfil lo crea el User Service al registrarse (evento interno): esperar a que exista.
  for (const p of PEOPLE) {
    for (let i = 0; i < 40; i++) {
      const { status } = await call('users', `/users/${who[p.key].id}`);
      if (status === 200) break;
      await sleep(250);
    }
    must(await call('users', '/users/me', { method: 'PATCH', token: who[p.key].token, body: { bio: p.bio } }), [200], `bio de ${p.username}`);
  }

  const already = await call('posts', `/posts?authorId=${who.ana.id}&limit=1`);
  if (!FORCE && already.data?.total > 0) {
    console.log('\nYa había datos de demostración; no se vuelve a sembrar (usa --force para repetir).');
    console.log(`Cuenta de prueba: demo / ${PASSWORD}`);
    return;
  }

  console.log('Seguidores');
  for (const [from, targets] of Object.entries(FOLLOWS)) {
    for (const to of targets) {
      const res = await call('users', `/users/${who[to].id}/follow`, { method: 'POST', token: who[from].token });
      must(res, [201, 409], `${from} sigue a ${to}`);
    }
  }
  console.log(`   ✓ ${Object.values(FOLLOWS).flat().length} relaciones`);

  console.log('Publicaciones');
  const postId = {};
  for (const post of POSTS) {
    const body = { type: post.type, content: post.content, ...(post.title && { title: post.title }) };
    const created = must(await call('posts', '/posts', { method: 'POST', token: who[post.by].token, body }), [201], `post ${post.key}`);
    postId[post.key] = created.id;
  }
  console.log(`   ✓ ${POSTS.length} publicaciones`);

  console.log('Comentarios y reacciones');
  for (const [key, by, content] of COMMENTS) {
    must(await call('posts', `/posts/${postId[key]}/comments`, { method: 'POST', token: who[by].token, body: { content } }), [201], `comentario en ${key}`);
  }
  let reactions = 0;
  for (const [key, votes] of REACTIONS) {
    for (const [by, type] of Object.entries(votes)) {
      must(await call('posts', `/posts/${postId[key]}/reactions`, { method: 'PUT', token: who[by].token, body: { type } }), [200], `reacción en ${key}`);
      reactions++;
    }
  }
  console.log(`   ✓ ${COMMENTS.length} comentarios, ${reactions} reacciones`);

  console.log('Mensajes');
  for (const [from, to, content] of CHATS) {
    must(await call('chat', `/chat/conversations/${who[to].id}/messages`, { method: 'POST', token: who[from].token, body: { content } }), [201], `mensaje ${from} → ${to}`);
  }
  console.log(`   ✓ ${CHATS.length} mensajes`);

  console.log(`\nListo. Cuenta de prueba: demo / ${PASSWORD}`);
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
