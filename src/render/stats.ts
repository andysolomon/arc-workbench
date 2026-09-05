// Render counters: how many times a node / edge component body ran. The Stress Lab reads them to
// prove telemetry patches never re-render unchanged topology. Cheap enough to leave on.
export const renderStats = { node: 0, edge: 0 };
export const resetRenderStats = (): void => { renderStats.node = 0; renderStats.edge = 0; };
