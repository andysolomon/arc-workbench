import type { WorkbenchController } from '../../src/app/controller';
import type { ParadigmId } from '../../src/model';
declare global { interface Window { __workbench: { ctl: WorkbenchController; loadStress: (pid: ParadigmId, nodes: number, edges: number) => void } } }
export {};
