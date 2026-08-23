const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });

<div className="relative">
  <video src={videoUrl} className="w-full" />
  <CropSelector
    videoWidth={video.width}
    videoHeight={video.height}
    crop={crop}
    onChange={setCrop}
  />
</div>
