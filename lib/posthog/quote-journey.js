// Use ordered same-session completions, not all contact submissions.
export function quoteJourney(totals) {
 const starts=totals?.quoteStarts,completed=totals?.completedFunnel;
 if(!Number.isSafeInteger(starts)||!Number.isSafeInteger(completed)||starts<0||completed<0||completed>starts)
  return {starts:null,completed:null,completionRate:null,dropOffRate:null,dropOff:null};
 return {starts,completed,dropOff:starts-completed,completionRate:starts?100*completed/starts:null,dropOffRate:starts?100*(starts-completed)/starts:null};
}
