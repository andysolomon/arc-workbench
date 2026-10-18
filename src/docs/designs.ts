// The words on the System designs page: one entry per example document. Numbers are not written
// here; they come from facts.ts, so the prose describes the mechanism and the facts carry the
// measurements. `figure` is the Anatomy figure that explains the design as a physical object:
// `live` ones are built by figures/<id>/build.mjs into public/figures/, `planned` ones are the
// object the next figure will be.
import type { ParadigmId } from '../model/document';

export interface DesignFigure { status: 'live' | 'planned'; object: string; file?: string }
export interface Design { id: string; paradigm: ParadigmId; title: string; lede: string; how: string[]; watch: string; figure: DesignFigure }

export const DESIGNS: Design[] = [
  {
    id: 'prod', paradigm: 'architecture', title: 'Production Deployment',
    lede: 'A request path through an edge, a gateway and two availability zones, with events, telemetry and a disaster-recovery copy behind it.',
    how: [
      'Customers hit a global edge first, and only 40% of requests travel on to the origin. The API gateway splits what arrives evenly over two pod groups in separate availability zones, so losing one zone halves capacity instead of ending service.',
      'Both zones read a multi-AZ Redis and send 30% of their requests on to PostgreSQL. They also publish to an event bus, where workers consume orders.v1 and ship telemetry and audit evidence off the request path. PostgreSQL streams its write-ahead log to a replica in a second region.',
    ],
    watch: 'At the preset’s load the workers are already saturated, but they sit behind the event bus, so their backlog doesn’t slow the average customer request. The Workbench’s p99 still rises with them, because its saturation term counts every node, asynchronous ones included. As more traffic reaches origin, the DR replica, the smallest database, is the first to saturate.',
    figure: { status: 'live', file: 'production-deployment', object: 'An airport terminal with its roof off: self-service kiosks at the doors answer most travellers, and a queue barrier splits the rest into two identical check-in halls behind a glazed partition, whose desks read one departures board and write to the reservations ledger. Every bag rides the belt to a baggage hall where four handlers can’t keep up and the carousel piles high, while a pneumatic tube carries ledger copies across the apron to a small standby terminal.' },
  },
  {
    id: 'video', paradigm: 'architecture', title: 'Video Platform',
    lede: 'Playback and upload as two different paths: a read path served from the edge and a write path that becomes background work.',
    how: [
      'Viewers stream through the CDN, and only cache misses reach the Playback API, which reads manifests from Redis and video records from the metadata database. Uploads go through the API gateway to an Upload Service that stores the file, records it and queues a transcode job.',
      'Transcode workers pull jobs from the queue and write three renditions back to object storage for every job. The metadata database streams change-data-capture onto video.events, where analytics, the search indexer and notifications each consume it independently. In the Workbench’s model that stream carries everything the database serves, reads included, so analytics load follows playback too.',
    ],
    watch: 'At the preset’s load the transcode workers finish far fewer jobs than arrive, so the queue grows. The queue keeps that backlog away from uploads and playback, which is why this is the place to add workers. The analytics pipeline is the next hot spot, already in the warning band.',
    figure: { status: 'live', file: 'video-platform', object: 'A film lab and projection room on one long table: a projector serves most screenings from the magazine of reels in front of it and sends the misses down a cable to the projectionist’s console, with its schedule card rack and card catalogue. Exposed cans posted into an intake box pile up in a tray beside six slow developing tanks under a safelight, developed prints slide into a flat-file vault, and the catalogue’s change log prints on a glass-dome ticker whose tape runs past a tally counter, an index-card sorter and a desk bell.' },
  },
  {
    id: 'single', paradigm: 'architecture', title: 'Single Server',
    lede: 'The baseline: one API server in front of one database.',
    how: [
      'Every request is handled by a single API instance that queries Postgres before it answers. There is no redundancy and nothing to balance, so the whole system is as fast and as available as those two boxes.',
    ],
    watch: 'Read the capacity table against the load. The smaller of the two capacities is the whole system’s ceiling: past the API’s limit, Postgres never sees more than the server passes on, so it idles at about half while the API saturates. A single failure is a full outage.',
    figure: { status: 'live', file: 'single-server', object: 'Two glass funnels in series on a lab retort stand: a steel hopper pours sand at the load, the upper funnel’s narrow neck is the API server and the lower one’s is Postgres. Sand heaps in a funnel when more arrives than its neck passes, and past the API’s limit it spills over the lip into a tray while the lower funnel runs half-empty.' },
  },
  {
    id: 'lb', paradigm: 'architecture', title: 'Load Balanced',
    lede: 'One load balancer spreads requests across three identical API pods that all query the same Postgres.',
    how: [
      'The load balancer deals each request to the next pod in turn, splitting traffic 34 / 33 / 33. Each pod gets a third of the load, so the stateless tier holds three times what one server could.',
      'Every pod still sends each request’s query to the same Postgres. Adding pods multiplies the API tier’s capacity, but not the database’s.',
    ],
    watch: 'The bottleneck moves to the database. Past its capacity, retries pile onto the saturated database and errors jump, and it only recovers once load falls well below that capacity again.',
    figure: {
      status: 'live', file: 'load-balanced',
      object: 'A rotary distributor on a bench: its rotor turns over three brass commutator segments, sized 34 / 33 / 33, and deals each request to a pod. Each box’s window glows with its utilization.',
    },
  },
  {
    id: 'cache', paradigm: 'architecture', title: 'Cache Aside',
    lede: 'The API asks Redis first and only falls back to Postgres on a miss.',
    how: [
      'Every request reads Redis by key. In the preset, 20% are misses, and only those go on to Postgres, which answers and lets the API repopulate the key for next time.',
    ],
    watch: 'The database only sees the miss rate. A cold cache or a mass eviction sends all of the traffic to Postgres at once, so its capacity has to cover more than the steady-state 20%.',
    figure: { status: 'live', file: 'cache-aside', object: 'A shop parts counter: every request turns the revolving bin carousel on the countertop (Redis), a lever on the counter sets the miss rate, and every miss sends a dumbwaiter car up its shaft to the stock loft (Postgres), while customers take a number at the dispenser in front.' },
  },
  {
    id: 'workers', paradigm: 'architecture', title: 'Async Workers',
    lede: 'An ingest API accepts jobs onto a queue, and a pool of workers does the slow part later.',
    how: [
      'The ingest API only validates a job and enqueues it, so it answers quickly. Three workers pull jobs off the queue at their own pace and write the results to Postgres.',
    ],
    watch: 'A burst becomes queue depth instead of latency for the client. What matters is whether the workers drain faster than jobs arrive. At the preset’s load they don’t, so the queue grows until more workers are added.',
    figure: { status: 'live', file: 'async-workers', object: 'A ticket rail on a bench: the ingest API hangs each job on the rail and answers at once, and a rack of worker cartridges, as many switched on as the Workers node has instances, pulls tickets off the far end while a depth gauge reads the queue.' },
  },
  {
    id: 'replicas', paradigm: 'architecture', title: 'Read Replicas',
    lede: 'Writes go to one primary, and reads spread across replicas that follow its write-ahead log.',
    how: [
      'The API sends its writes (20% of traffic) to the primary and splits reads evenly over two replicas. The primary ships its write-ahead log to both replicas, so they replay every change shortly after it happens.',
    ],
    watch: 'Replicas scale reads, not writes. Every replica also replays every write from the log, so a write-heavy mix saturates the replicas before the primary, and adding replicas then buys nothing. A read right after a write can see the old value while the log is in flight.',
    figure: { status: 'live', file: 'read-replicas', object: 'A pantograph copying table: an elbow drafting machine clamped to the back edge holds a long copy beam with three styluses, so the stroke written on the master tablet in the middle is drawn on both copy tablets at once, every write replayed on every replica. Reading lamps over the copies serve the reads, and a dial in front of each tablet reads its utilization.' },
  },
  {
    id: 'ratelimit', paradigm: 'architecture', title: 'Rate Limited API',
    lede: 'A limiter in front of the API admits up to its limit and rejects the rest before it costs anything.',
    how: [
      'The rate limiter sheds whatever arrives above its 900 rps limit, so the API and Postgres only ever see admitted traffic. The preset offers 2,000 rps, so more than half is turned away at the door.',
    ],
    watch: 'Rejected requests show up as errors by design. The limiter protects the services behind it, and the limit has to sit below what they can actually serve.',
    figure: { status: 'live', file: 'rate-limited-api', object: 'A turnstile tower: its arms turn at the rate the limiter admits, requests over the limit drop through a slot into a reject bin whose meter shows the share turned away, and the API and Postgres behind it only see what got through.' },
  },
  {
    id: 'release', paradigm: 'workflow', title: 'Release Delivery Workflow',
    lede: 'A change moves from commit to production through review, CI gates, a human approval and a canary.',
    how: [
      'Work crosses four lanes: developer, continuous integration, release governance and production. A commit becomes a pull request, which needs two approvals to merge, then a build and the quality gates for tests and scans.',
      'A release owner approves, the change goes to a canary, and a healthy SLO window promotes it to a release that writes its own notes. A failed gate or a denied approval sends the change back to the pull request, and an SLO breach on the canary pages on-call and rolls back.',
    ],
    watch: 'Every gate multiplies the chance of getting through on the first pass, and the human approval dominates the time: at 40 changes an hour, about half of the changes in flight are waiting at it, and 7–8% of completions are rollbacks. The facts below are the happy path; every rework edge adds a loop.',
    figure: { status: 'live', file: 'release-workflow', object: 'A bottling line: one conveyor runs through a loader with the line-speed knob, a review gantry with two inspectors’ stamps, a filler, an inspection camera with a reject pusher, a hand stamping press, a sampling probe with its rack of vials, and a capper, into a shipping crate. Rejects ride a return conveyor and an elevator back to review, failed canaries drop down a chute into a rolled-back bin, and the bottles waiting on the belt are the changes in flight at each step.' },
  },
  {
    id: 'cachemiss', paradigm: 'sequence', title: 'Cache-miss Request',
    lede: 'One dashboard request, message by message: authentication, a cache miss, the database read and the write-back.',
    how: [
      'The user opens a page, and the web app calls the API, which verifies the JWT with Auth. It then reads Redis and gets a miss, so it queries Postgres for the profile and metrics.',
      'The API writes the result back to Redis without waiting for it and answers the web app, which renders the page. Last, the API emits a trace span, also without waiting.',
    ],
    watch: 'Time is serial in a sequence. The slowest hop sets the shape of the request, and fire-and-forget messages don’t add to it.',
    figure: { status: 'live', file: 'cache-miss-request', object: 'A pneumatic tube station: seven stations in a row behind a glass tube, one lit capsule carrying the request hop by hop at the speed of each hop’s latency, a thinner tube for the fire-and-forget messages, and a stopwatch reading the elapsed time.' },
  },
  {
    id: 'analytics', paradigm: 'dataflow', title: 'Product Analytics',
    lede: 'Clickstream and app events flow through ingest, a consent gate and a stream into storage and consumers.',
    how: [
      'The web and mobile apps emit events to an edge API. The edge sends identity and consent data through a consent gate into a PII vault, inside a governed zone, and every accepted event onto a 24-partition stream. In the Workbench’s model the two sources split the offered load evenly and their 60% and 40% weights then scale each one’s share, so the edge API sees half of the offered events.',
      'The stream feeds the warehouse, and poison messages go to a dead-letter topic. Dashboards query the warehouse, daily aggregates feed a feature store, and the store feeds an ML model. The only path from identities to dashboards is a restricted join.',
    ],
    watch: 'Everything after ingest is asynchronous, so lag shows up as backlog, not as user latency. At the preset’s load that backlog builds in front of the ML model, and once it has fallen behind, retries hold it there: five instances keep up from a cold start, but it takes six to recover. Governance is structural: personal data only crosses the zone through governed edges.',
    figure: { status: 'live', file: 'product-analytics', object: 'A water-treatment works on a site plate: a canal intake (the web app) and a windpump over a well (mobile) feed a pump house (the edge API), and a consent sluice diverts identity water into a sealed tank inside a fenced compound, entered and left only through two glands. The rest runs down a 24-lane settling channel (the stream) past a reject sump (the dead-letter queue) into a reservoir (the warehouse) that feeds a trough fountain (dashboards) and a header tank (the feature store), which feeds a six-cell slow sand filter (the ML model, one cell per instance) whose inlet channel fills with the backlog.' },
  },
  {
    id: 'agentrun', paradigm: 'state', title: 'Agent Run Lifecycle',
    lede: 'The states an agent run can occupy, from queued to one of four terminal outcomes.',
    how: [
      'A run is queued, planned, executed and reviewed. While executing, it can need human approval for risky work, block on missing input, or retry after a tool error, and review can send it back to planning to revise.',
      'Approvals and blocks time out after 48 h and 24 h. Retries give up after the third attempt, and a run is cancelled if the user stops it during planning or the approval is denied.',
    ],
    watch: 'Loops decide the outcome. Retry, revise and resume all return the run to earlier states, and the shares below are where runs end up once every loop has played out.',
    figure: { status: 'live', file: 'agent-run-lifecycle', object: 'A pinball table: a saucer for each state, lanes engraved as wide as each transition’s weight, and chrome drain cups for the four outcomes. A plunger launches a traced run along the lanes the Workbench’s Markov simulator takes, resting balls are runs waiting, and a counter in front of each cup shows its share of finished runs.' },
  },
];
