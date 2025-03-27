
async function getTimes(){
    const { startTime, endTime } = await import(`getContestTime.mjs`);
    console.log(startTime);
}
getTimes();