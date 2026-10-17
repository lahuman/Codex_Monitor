const periods = {
  weekly: { values: [49, 72], resets: ["3일 후 초기화", "5일 후 초기화"], paths: ["M0 29H58V35H118V43H180V48H237V59H297V65H360V72H421V80H480", "M0 17H58V22H118V29H180V32H237V34H297V39H360V43H421V46H480"] },
  session: { values: [86, 94], resets: ["2시간 후 초기화", "4시간 후 초기화"], paths: ["M0 19H90V26H160V33H239V41H270V20H340V25H410V31H480", "M0 11H90V15H160V20H239V24H270V10H340V13H410V17H480"] },
};
const names = ["first", "second"];
for (const button of document.querySelectorAll("[data-period]")) {
  button.addEventListener("click", () => {
    const period = periods[button.dataset.period];
    for (const control of document.querySelectorAll("[data-period]"))
      control.setAttribute("aria-pressed", String(control === button));
    names.forEach((name, index) => {
      document.getElementById(`${name}-percent`).replaceChildren(document.createTextNode(String(period.values[index])), Object.assign(document.createElement("span"), { textContent: "%" }));
      document.getElementById(`tray-${name}`).textContent = `${period.values[index]}%`;
      document.getElementById(`ring-${name}`).setAttribute("stroke-dasharray", `${period.values[index]} 100`);
      document.getElementById(`${name}-reset`).textContent = period.resets[index];
    });
    document.getElementById("blue-chart").setAttribute("d", period.paths[0]);
    document.getElementById("green-chart").setAttribute("d", period.paths[1]);
  });
}
