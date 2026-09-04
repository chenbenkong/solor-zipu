import io

# 1) ShipSystem.getHudState 增加 shipId
p = 'src/three/ship/ShipSystem.js'
s = io.open(p, encoding='utf-8').read()
old = "      inspect: this.inspector.active,"
new = "      shipId: this.shipId,\n      inspect: this.inspector.active,"
assert old in s
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('ShipSystem OK')

# 2) CockpitHud 用 shipId 查机型名显示标题
p2 = 'src/components/CockpitHud.jsx'
s2 = io.open(p2, encoding='utf-8').read()
old2 = "import React, { useState, useRef } from 'react';"
new2 = "import React, { useState, useRef } from 'react';\nimport { SHIP_VARIANTS } from '../three/ship/shipRegistry.js';"
assert old2 in s2
s2 = s2.replace(old2, new2, 1)
old3 = "<span className=\"insp-title\">⬡ 星隼号 · 结构检视</span>"
new3 = """<span className="insp-title">⬡ {(SHIP_VARIANTS.find(v => v.id === hud.shipId) || SHIP_VARIANTS[0]).name} · 结构检视</span>"""
assert old3 in s2
s2 = s2.replace(old3, new3, 1)
io.open(p2, 'w', encoding='utf-8').write(s2)
print('CockpitHud OK')

# 3) shipRegistry.js：从 createShipVariants 导出 SHIP_VARIANTS（便于组件引用）
p3 = 'src/three/ship/shipRegistry.js'
io.open(p3, 'w', encoding='utf-8').write(
    "// 机型注册表：主场景/机库/HUD 共用\nexport { SHIP_VARIANTS } from './createShipVariants.js';\n"
)
print('shipRegistry OK')
