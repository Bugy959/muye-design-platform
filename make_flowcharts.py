import sys
from pathlib import Path
sys.path.insert(0, str(Path(sys.executable).parent.parent.parent))
from daimon_runtime import setup_plot
setup_plot()

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = Path(r"E:\木叶设计平台\docs-assets")
OUT.mkdir(exist_ok=True)

C_MAIN = "#1d3b2a"   # brand deep green
C_FILL = "#eef3ef"   # soft green
C_WARN = "#c0392b"
C_WARN_FILL = "#fdf0ee"
C_BLUE = "#2f5d8a"
C_BLUE_FILL = "#eef3f9"
C_AMBER = "#b9770e"
C_AMBER_FILL = "#fdf6e8"


def box(ax, x, y, w, h, text, fc=C_FILL, ec=C_MAIN, fs=11, tc="#1a1a1a", bold=False):
    p = FancyBboxPatch((x - w / 2, y - h / 2), w, h,
                       boxstyle="round,pad=0.02,rounding_size=0.06",
                       linewidth=1.4, edgecolor=ec, facecolor=fc, mutation_aspect=1)
    ax.add_patch(p)
    ax.text(x, y, text, ha="center", va="center", fontsize=fs, color=tc,
            fontweight="bold" if bold else "normal", linespacing=1.5)


def arrow(ax, x1, y1, x2, y2, color=C_MAIN, label=None, lx=0.0, ly=0.0, style="-|>", ls="-", fs=9):
    a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style, mutation_scale=14,
                        linewidth=1.4, color=color, linestyle=ls, shrinkA=2, shrinkB=2)
    ax.add_patch(a)
    if label:
        ax.text((x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, label, fontsize=fs, color=color,
                ha="center", va="center",
                bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.9))


def canvas(w, h):
    fig, ax = plt.subplots(figsize=(w, h), dpi=200)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis("off")
    return fig, ax


# ============ 图1：登录与角色分流 ============
fig, ax = canvas(9, 5.2)
box(ax, 5, 9.0, 3.2, 0.9, "登录页\n（仅账号 + 密码）", fc=C_FILL, ec=C_MAIN, bold=True)
box(ax, 1.8, 6.4, 2.6, 1.0, "医院 / 加工厂端\n（客户）", fc=C_BLUE_FILL, ec=C_BLUE, bold=True)
box(ax, 5.0, 6.4, 2.6, 1.0, "设计师端", fc=C_BLUE_FILL, ec=C_BLUE, bold=True)
box(ax, 8.2, 6.4, 2.6, 1.0, "管理端\n（最高权限）", fc=C_AMBER_FILL, ec=C_AMBER, bold=True)
box(ax, 1.8, 3.4, 2.9, 2.2, "提交订单（预扣积分）\n我的订单 / 下载设计稿\n积分余额与明细\n消息提醒", fs=10)
box(ax, 5.0, 3.4, 2.9, 2.2, "接单大厅（抢单）\n我的订单\n打回 / 提交设计文件\n（不可见积分与来源）", fs=10)
box(ax, 8.2, 3.4, 2.9, 2.2, "创建账号 / 改密码\n积分充值与扣减\n订单总览（可见全部）\n账单中心 / 设计师分组", fs=10)
arrow(ax, 4.2, 8.55, 2.1, 6.95)
arrow(ax, 5.0, 8.55, 5.0, 6.95)
arrow(ax, 5.8, 8.55, 7.9, 6.95)
arrow(ax, 1.8, 5.9, 1.8, 4.55)
arrow(ax, 5.0, 5.9, 5.0, 4.55)
arrow(ax, 8.2, 5.9, 8.2, 4.55)
ax.text(5, 0.6, "所有账号均由管理端统一创建，医院/加工厂与设计师不能自行注册",
        ha="center", fontsize=9.5, color="#666666")
fig.savefig(OUT / "flow-1-login.png", bbox_inches="tight")
plt.close(fig)

# ============ 图2：订单生命周期 ============
fig, ax = canvas(9.5, 6.2)
box(ax, 2.0, 9.0, 2.9, 1.0, "客户提交订单\n（口扫文件+照片必填）", fc=C_BLUE_FILL, ec=C_BLUE, bold=True, fs=10)
box(ax, 6.2, 9.0, 2.2, 0.85, "待接单", bold=True)
box(ax, 6.2, 6.9, 2.2, 0.85, "设计中", fc=C_BLUE_FILL, ec=C_BLUE, bold=True)
box(ax, 6.2, 4.8, 2.2, 0.85, "已完成", fc="#e8f3ec", ec="#1e7a4a", bold=True)
box(ax, 2.0, 6.9, 2.4, 0.85, "已打回", fc=C_WARN_FILL, ec=C_WARN, bold=True)
box(ax, 2.0, 4.8, 2.6, 0.95, "客户修改后\n重新提交", fc=C_WARN_FILL, ec=C_WARN, fs=10)
box(ax, 8.9, 6.9, 1.9, 0.85, "返工单\n回接单大厅", fc=C_WARN_FILL, ec=C_WARN, fs=9.5)

arrow(ax, 3.5, 9.0, 5.05, 9.0, label="积分预扣成功", ly=0.28)
arrow(ax, 6.2, 8.55, 6.2, 7.35, label="设计师抢单", lx=-1.35)
arrow(ax, 6.2, 6.45, 6.2, 5.25, label="提交设计文件", lx=1.45, ly=0.35)
arrow(ax, 5.05, 6.9, 3.25, 6.9, color=C_WARN, label="打回：信息不全/数据有问题", ly=0.35, fs=8.5)
arrow(ax, 2.0, 6.45, 2.0, 5.3, color=C_WARN)
arrow(ax, 2.6, 4.35, 5.2, 8.5, color=C_WARN, label="多退少补，重新进入大厅", lx=-0.4, ly=-0.4, fs=8.5)
arrow(ax, 7.35, 4.8, 8.85, 6.45, color=C_WARN, label="客户申请返工", lx=1.15, ly=-0.2, fs=8.5)
arrow(ax, 8.55, 7.2, 7.0, 8.6, color=C_WARN, fs=8.5)

ax.text(5.2, 0.5, "完成标准：设计师上传设计文件并提交，订单即为完成；客户可在订单中下载设计文件",
        ha="center", fontsize=9.5, color="#666666")
fig.savefig(OUT / "flow-2-order.png", bbox_inches="tight")
plt.close(fig)

# ============ 图3：积分流转 ============
fig, ax = canvas(9, 6.0)
box(ax, 2.2, 8.8, 2.8, 0.9, "客户微信转账\n给管理方", fc=C_AMBER_FILL, ec=C_AMBER, bold=True, fs=10)
box(ax, 6.6, 8.8, 2.8, 0.9, "管理端手动充值\n（积分管理）", bold=True, fs=10)
box(ax, 6.6, 6.6, 2.8, 0.9, "客户积分余额", fc=C_BLUE_FILL, ec=C_BLUE, bold=True)
box(ax, 2.2, 6.6, 2.8, 0.95, "提交订单\n按类型×牙数预扣", fc=C_BLUE_FILL, ec=C_BLUE, fs=10)
box(ax, 2.2, 4.2, 2.8, 0.95, "余额不足\n→ 无法提交订单", fc=C_WARN_FILL, ec=C_WARN, fs=10)
box(ax, 6.6, 4.2, 2.8, 0.95, "打回后重新提交\n按新牙位多退少补", fs=10)
box(ax, 6.6, 1.9, 2.8, 0.9, "积分流水\n（客户可见明细）", fs=10)

arrow(ax, 3.65, 8.8, 5.15, 8.8)
arrow(ax, 6.6, 8.35, 6.6, 7.1)
arrow(ax, 5.15, 6.6, 3.65, 6.6, label="下单即扣", ly=0.28)
arrow(ax, 2.2, 6.1, 2.2, 4.75, color=C_WARN)
arrow(ax, 5.15, 4.2, 3.65, 4.2)
arrow(ax, 6.6, 5.15, 6.6, 6.05, label="退回", lx=0.55)
arrow(ax, 6.6, 3.7, 6.6, 2.4)

ax.text(4.9, 7.62, "积分单价：即刻设计 8 分/颗，全瓷冠·基台上部冠 5 分/颗，贴面·嵌体 10 分/颗；\n贴面·嵌体加急每颗 +5 分；返工单不重复扣积分",
        ha="center", fontsize=9.5, color="#555555",
        bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="#dddddd", alpha=0.95))
ax.text(4.9, 0.6, "设计师端不显示任何积分信息；积分解释权归平台管理方所有",
        ha="center", fontsize=9.5, color="#666666")
fig.savefig(OUT / "flow-3-points.png", bbox_inches="tight")
plt.close(fig)

# ============ 图4：抢单与打回 ============
fig, ax = canvas(9, 5.6)
box(ax, 2.0, 8.8, 2.6, 0.9, "新订单进入\n接单大厅", bold=True, fs=10)
box(ax, 6.5, 8.8, 3.4, 0.9, "全体设计师可见\n（只显示单号/牙位/要求）", fc=C_BLUE_FILL, ec=C_BLUE, fs=10)
box(ax, 6.5, 6.5, 3.4, 0.95, "点击「接单」\n先到先得（抢单制）", fc=C_BLUE_FILL, ec=C_BLUE, bold=True, fs=10)
box(ax, 6.5, 4.2, 3.4, 0.95, "订单进入该设计师\n「我的订单」开始设计", fs=10)
box(ax, 2.0, 6.5, 2.6, 0.95, "信息不全 / 数据有问题\n→ 打回给客户", fc=C_WARN_FILL, ec=C_WARN, fs=9.5)
box(ax, 2.0, 4.2, 2.6, 0.95, "客户补齐资料后\n重新提交", fc=C_WARN_FILL, ec=C_WARN, fs=9.5)

arrow(ax, 3.35, 8.8, 4.75, 8.8)
arrow(ax, 6.5, 8.35, 6.5, 7.0)
arrow(ax, 6.5, 6.0, 6.5, 4.7)
arrow(ax, 4.75, 6.5, 3.35, 6.5, color=C_WARN)
arrow(ax, 2.0, 6.0, 2.0, 4.7, color=C_WARN)
arrow(ax, 2.6, 3.75, 4.9, 8.35, color=C_WARN, label="重新排队", lx=0.2, ly=0.2, fs=8.5)

ax.text(4.9, 0.7, "同一订单被接单后立即从大厅消失，其他设计师不可再接；打回单清除原设计师，重新进入大厅",
        ha="center", fontsize=9.5, color="#666666")
fig.savefig(OUT / "flow-4-grab.png", bbox_inches="tight")
plt.close(fig)

print("done:", [p.name for p in sorted(OUT.glob('*.png'))])
