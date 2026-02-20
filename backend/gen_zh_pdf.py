from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import urllib.request
import os

if not os.path.exists("simhei.ttf"):
    urllib.request.urlretrieve("https://github.com/mzyy94/wqy-microhei/raw/master/wqy-microhei.ttc", "wqy-microhei.ttc")

pdfmetrics.registerFont(TTFont('wqy', 'wqy-microhei.ttc'))

c = canvas.Canvas("zh_multi.pdf")
c.setFont('wqy', 24)
c.drawString(100, 700, "测试第一页")
c.showPage()
c.setFont('wqy', 24)
c.drawString(100, 700, "测试第二页")
c.showPage()
c.setFont('wqy', 24)
c.drawString(100, 700, "测试第三页")
c.save()
