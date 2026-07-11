export const exportReportToPDF = async (
  report: any,
  scenarioName: string,
  targetGoal: string,
  imageUrl: string | null,
  isCustomGoalActive: boolean
) => {
  // ponytail: native print covers PDF export
  window.print();
  return Promise.resolve();
};
