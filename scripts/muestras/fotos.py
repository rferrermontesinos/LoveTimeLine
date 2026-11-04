# Genera por ordenador las fotos de muestra de public/muestras (sin personas ni fotos reales).
# Uso: python3 scripts/muestras/fotos.py public/muestras
import numpy as np, sys, os
from PIL import Image, ImageFilter
OUT=sys.argv[1]
rng=np.random.default_rng(7)
def hx(h): h=h.lstrip('#'); return np.array([int(h[i:i+2],16) for i in (0,2,4)],dtype=np.float32)
def vgrad(W,H,stops):
    ys=np.linspace(0,1,H); img=np.zeros((H,W,3),np.float32)
    pos=[s[0] for s in stops]; cols=[hx(s[1]) for s in stops]
    for c in range(3):
        img[:,:,c]=np.interp(ys,pos,[k[c] for k in cols])[:,None]
    return img
def soft_circle(img,cx,cy,r,col,alpha,edge=0.15,mode='screen'):
    H,W,_=img.shape
    x0,x1=max(0,int(cx-r-2)),min(W,int(cx+r+2)); y0,y1=max(0,int(cy-r-2)),min(H,int(cy+r+2))
    if x0>=x1 or y0>=y1: return
    yy,xx=np.mgrid[y0:y1,x0:x1]; d=np.sqrt((xx-cx)**2+(yy-cy)**2)/r
    a=np.clip((1-d)/edge,0,1)*alpha; a=a[:,:,None]; c=hx(col)
    reg=img[y0:y1,x0:x1]
    if mode=='screen': img[y0:y1,x0:x1]=255-(255-reg)*(1-a*c/255)
    else: img[y0:y1,x0:x1]=reg*(1-a)+c*a
def finish(img,name,blur=2.0,grain=7,vig=0.25):
    im=Image.fromarray(np.clip(img,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    a=np.asarray(im).astype(np.float32); H,W,_=a.shape
    yy,xx=np.mgrid[0:H,0:W]; d=np.sqrt(((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2)
    a*= (1-vig*np.clip(d-0.5,0,1)**1.5)[:,:,None]
    a+= rng.normal(0,grain,(H,W,1))
    Image.fromarray(np.clip(a,0,255).astype(np.uint8)).save(os.path.join(OUT,name),quality=86,optimize=True,progressive=True)

# 1 mar al atardecer (vertical)
W,H=1000,1200; hz=int(H*0.6)
img=vgrad(W,H,[(0,'#28305A'),(0.22,'#5B4C80'),(0.42,'#C9706A'),(0.56,'#F0A76E'),(0.6,'#F8D59C'),(0.601,'#5A5F78'),(0.75,'#2E3C55'),(1,'#121A28')])
soft_circle(img,620,hz-30,330,'#F59A62',0.45,edge=1.0)
soft_circle(img,620,hz-30,150,'#FFD39A',0.6,edge=1.0)
soft_circle(img,620,hz-28,58,'#FFF1D2',1.0,edge=0.08,mode='over')
for y in range(hz+2,H):
    t=(y-hz)/(H-hz); spread=40+t*260
    for _ in range(int(3+6*(1-t))):
        x=620+rng.normal(0,spread*0.45); L=rng.uniform(10,60)*(0.4+t)
        a=rng.uniform(0.2,0.7)*(1-t*0.8)
        x0,x1=int(max(0,x-L)),int(min(W,x+L)); 
        if x1>x0: img[y,x0:x1]=img[y,x0:x1]*(1-a)+hx('#FFCF95')*a
finish(img,'mar-atardecer.jpg',blur=2.6)

# 2 montañas (horizontal)
W,H=1200,1000
img=vgrad(W,H,[(0,'#C9D7E3'),(0.45,'#EADCCB'),(0.6,'#F3D9BC'),(1,'#F3D9BC')])
soft_circle(img,880,330,300,'#FFE6C2',0.55,edge=1.0)
xs=np.arange(W)
layers=[(0.50,'#B7C3CF',60),(0.58,'#93A6B7',75),(0.67,'#6E8497',85),(0.77,'#4C6274',95),(0.88,'#2F4252',80)]
for base,col,amp in layers:
    ph=rng.uniform(0,6.28,4); f=rng.uniform(0.002,0.009,4)
    y=H*base - sum(amp*(0.6**i)*np.sin(xs*f[i]+ph[i]) for i in range(4)) + np.convolve(rng.normal(0,6,W),np.ones(25)/25,'same')
    yy=np.arange(H)[:,None]; mask=(yy>=y[None,:])
    c=hx(col); img[mask]=img[mask]*0.08+c*0.92
finish(img,'montanas.jpg',blur=1.6,grain=6,vig=0.2)

# 3 luces de fiesta (vertical)
W,H=1000,1200
img=vgrad(W,H,[(0,'#160F1C'),(0.6,'#2A1518'),(1,'#3E2016')])
cols=['#FFC56E','#FF9A5C','#F7D9A0','#F28A7A','#FFE2B0','#E8B65A']
for _ in range(70):
    r=rng.uniform(18,95); cx=rng.uniform(-40,W+40); cy=rng.uniform(-40,H*0.78)
    soft_circle(img,cx,cy,r,cols[rng.integers(len(cols))],rng.uniform(0.18,0.55),edge=rng.uniform(0.08,0.4))
soft_circle(img,W*0.5,H*1.05,620,'#D9824A',0.35,edge=1.0)
finish(img,'luces.jpg',blur=2.2,grain=8,vig=0.35)

# 4 nieve (horizontal)
W,H=1200,1000; gz=int(H*0.62)
img=vgrad(W,H,[(0,'#B8C8D8'),(0.55,'#E6ECF1'),(0.62,'#EEF2F5'),(0.621,'#F2F5F8'),(1,'#DDE6EE')])
for i,(px,s) in enumerate([(160,1.0),(260,0.7),(930,1.1),(1040,0.8),(1110,0.6)]):
    h=int(260*s); w=int(110*s); base=gz+6
    for k in range(5):
        top=base-h+k*h//6; wid=w*(0.35+k*0.16)
        yy,xx=np.mgrid[top:base, max(0,int(px-wid)):min(W,int(px+wid))]
        m=np.abs(xx-px) <= (yy-top)/(base-top+1e-6)*wid
        img[yy[m],xx[m]]=img[yy[m],xx[m]]*0.15+hx('#56707F')*0.85
yy=np.arange(gz,H)[:,None]; xs=np.arange(W)[None,:]
shade=0.5+0.5*np.sin(xs*0.006+yy*0.01)
img[gz:H]=img[gz:H]*(1-0.12*shade[:,:,None])+hx('#9FB4C8')*(0.12*shade[:,:,None])
finish(img,'nieve-base.jpg',blur=1.4,grain=0,vig=0)
img=np.asarray(Image.open(os.path.join(OUT,'nieve-base.jpg'))).astype(np.float32)
for _ in range(420):
    soft_circle(img,rng.uniform(0,W),rng.uniform(0,H),rng.uniform(2,9),'#FFFFFF',rng.uniform(0.5,0.95),edge=0.6,mode='over')
os.remove(os.path.join(OUT,'nieve-base.jpg'))
finish(img,'nieve.jpg',blur=0.9,grain=6,vig=0.18)

# 5 jardín en verano (vertical)
W,H=1000,1200
img=vgrad(W,H,[(0,'#C7C46E'),(0.35,'#86A04E'),(0.7,'#3E5B33'),(1,'#22361F')])
soft_circle(img,W*0.85,H*0.08,520,'#FFF0B5',0.75,edge=1.0)
for _ in range(55):
    soft_circle(img,rng.uniform(0,W),rng.uniform(0,H*0.75),rng.uniform(15,70),['#F6F1B0','#D9E58C','#FFFFFF','#B8D27A'][rng.integers(4)],rng.uniform(0.15,0.45),edge=rng.uniform(0.1,0.5))
finish(img,'jardin.jpg',blur=3.0,grain=7,vig=0.3)
print('ok')
