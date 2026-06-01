from PIL import Image

def crop_avatar():
    # Open the original 512x512 waving person image
    img = Image.open('evolve-mobile/assets/waving-person.png').convert("RGBA")
    width, height = img.size
    
    # 1. Extract the hand (top-left region)
    # Let's define the hand region box: X from 0 to 225, Y from 50 to 220
    hand_box = (0, 30, 225, 230)
    hand_crop = img.crop(hand_box)
    
    # Trim transparent pixels from the hand crop to get a tight bounding box
    bbox = hand_crop.getbbox()
    if bbox:
        tight_hand = hand_crop.crop(bbox)
        tight_hand.save('evolve-mobile/assets/waving-hand.png')
        print(f"Saved hand image with tight bbox: {bbox}")
    else:
        hand_crop.save('evolve-mobile/assets/waving-hand.png')
        print("Saved default hand region")

    # 2. Extract the body (original image with the hand erased/transparent)
    body_img = img.copy()
    body_pixels = body_img.load()
    
    # Let's erase the hand pixels by setting alpha to 0 inside the hand box
    for x in range(hand_box[0], hand_box[2]):
        for y in range(hand_box[1], hand_box[3]):
            # Optional: apply a smooth gradient or clean cut
            r, g, b, a = body_pixels[x, y]
            body_pixels[x, y] = (r, g, b, 0)
            
    body_img.save('evolve-mobile/assets/waving-body.png')
    print("Saved body image with hand masked out successfully!")

if __name__ == "__main__":
    crop_avatar()
