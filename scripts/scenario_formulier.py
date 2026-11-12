import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True)
    ctx=await b.new_context(viewport={"width":375,"height":812})
    geblokkeerd=[]
    async def blok(route):
      geblokkeerd.append(route.request.url.split("/functions/v1/")[-1].split("?")[0]); await route.abort()
    await ctx.route("**/functions/v1/**", blok)
    await ctx.route("**/rest/v1/**", lambda r: r.abort() if r.request.method != "GET" else r.continue_())
    pg=await ctx.new_page()
    await pg.goto("http://localhost:8080/bav-zzp"); await pg.wait_for_timeout(3500)
    for t in ["Alleen noodzakelijk","Alles accepteren"]:
      bt=pg.get_by_role("button",name=t)
      if await bt.count(): await bt.first.click(); break
    await pg.get_by_label("E-mailadres").first.fill("test+testpersoon@zpzaken.nl")
    await pg.get_by_label("Telefoonnummer").first.fill("0612345678")
    await pg.get_by_role("button", name="Aanvragen in 5 stappen").click(); await pg.wait_for_timeout(2500)
    await pg.get_by_role("button", name="Volgende").first.click(); await pg.wait_for_timeout(1500)
    await pg.screenshot(path="/tmp/browser/sc/b.png")
    print("knoppen", await pg.evaluate("Array.from(document.querySelectorAll('button,select')).map(b=>(b.tagName+':'+(b.getAttribute('aria-label')||b.textContent||'').trim()).slice(0,50)).filter(x=>x.length>4).slice(0,60)"))
    opties=await pg.evaluate("Array.from(document.querySelector('select').options).map(o=>o.value+'='+o.text)")
    print("opties", opties)
    for label in ["ICT","Bouw & techniek","ICT","Zorg"]:
      val=[o.split('=')[0] for o in opties if o.split('=',1)[1]==label]
      if not val: print(label,"niet gevonden"); continue
      await pg.locator("select").first.select_option(val[0]); await pg.wait_for_timeout(700)
      dlg=pg.locator("[role=dialog],[role=alertdialog]")
      zicht=await dlg.count()>0 and await dlg.first.is_visible()
      tekst=(await dlg.first.inner_text())[:80] if zicht else ""
      print("sector",label,"popup",zicht,tekst.replace("\n"," "))
      if zicht:
        await pg.screenshot(path=f"/tmp/browser/sc/popup_{val[0]}.png")
        await pg.get_by_role("button",name="Begrepen, verder met aanvragen").click(); await pg.wait_for_timeout(400)
    k=pg.get_by_role("button",name="Uitleg aantal medewerkers")
    await k.evaluate("e=>e.scrollIntoView({block:'center'})"); await k.focus(); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500)
    box=await pg.locator("[data-radix-popper-content-wrapper]").first.bounding_box()
    print("i-icoon popup", box, "binnen" if box and box["x"]>=0 and box["x"]+box["width"]<=375 else "BUITEN")
    await pg.screenshot(path="/tmp/browser/sc/i_icoon.png")
    sel=await pg.evaluate("Array.from(document.querySelectorAll('label')).map(l=>l.textContent.trim()).filter(Boolean).slice(0,40)")
    print(sel)
    print("combobox", await pg.get_by_role("combobox").count(), "medewerkers-i", await pg.get_by_role("button",name="Uitleg aantal medewerkers").count())
    await pg.screenshot(path="/tmp/browser/sc/a.png")
    print("geblokkeerd", geblokkeerd)
    await b.close()
asyncio.run(main())
