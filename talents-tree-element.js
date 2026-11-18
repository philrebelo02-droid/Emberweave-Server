/* Talent tree painted kits. Source: TALENT UI ART 16NOV2026/TREE TYPES.json. */
(function(root){
const TALENT_TREE_ELEMENT={
  "vael": {
    "red_harvest": "Dark",
    "ironblood": "Fire",
    "ashford_wall": "Neutral"
  },
  "absalie": {
    "empty_chair": "Dark",
    "great_knot": "Dark",
    "the_unsaid": "Lightning"
  },
  "aldren": {
    "bestiary": "Dark",
    "rewrite": "Dark",
    "living_book": "Neutral"
  },
  "ambrel": {
    "ringing_hours": "Light",
    "incense_penance": "Light",
    "gates": "Neutral"
  },
  "askel": {
    "ford": "Water",
    "standard": "Neutral",
    "charge": "Nature"
  },
  "astra": {
    "slow_burn": "Fire",
    "held_star": "Light",
    "second_sky": "Dark"
  },
  "aureth": {
    "hungry_brother": "Dark",
    "mending_brother": "Light",
    "third_brother": "Neutral"
  },
  "bloatus": {
    "plague_king": "Nature",
    "drowned_court": "Water",
    "kept_by_the_marsh": "Nature"
  },
  "brannus": {
    "champion": "Lightning",
    "bronze_wheel": "Neutral",
    "lions_pride": "Light"
  },
  "calypsa": {
    "never_bit_first": "Water",
    "straight_lines": "Water",
    "party_piece": "Lightning"
  },
  "carn": {
    "the_price": "Fire",
    "ferrow_crossing": "Neutral",
    "the_bottle": "Lightning"
  },
  "ceraline": {
    "guest_list": "Dark",
    "next_course": "Fire",
    "the_host": "Light"
  },
  "dandra": {
    "petal_by_petal": "Nature",
    "three_bees": "Nature",
    "gold_lantern": "Light"
  },
  "deepcleft": {
    "seam_reader": "Neutral",
    "nine_days_under": "Neutral",
    "undermine": "Lightning"
  },
  "fritz": {
    "livewire": "Lightning",
    "half_a_heartbeat": "Lightning",
    "storm_courier": "Light"
  },
  "grimsby": {
    "compound_interest": "Dark",
    "eviction": "Neutral",
    "ninety_one_entries": "Dark"
  },
  "grosk": {
    "sunkfen_hold": "Water",
    "old_jaws": "Nature",
    "mirewall": "Light"
  },
  "gruel": {
    "ledger": "Dark",
    "brass_scales": "Neutral",
    "appetite": "Nature"
  },
  "hobb": {
    "rings_false": "Neutral",
    "carrying_the_town": "Light",
    "on_the_wheel": "Fire"
  },
  "hollow": {
    "commission": "Dark",
    "every_cut": "Dark",
    "space_between": "Lightning"
  },
  "hurne": {
    "the_swineherd": "Nature",
    "feed_them": "Dark",
    "between_them_and_the_road": "Neutral"
  },
  "iver": {
    "twelfth_strike": "Lightning",
    "lightning_rod": "Light",
    "stormfront": "Lightning"
  },
  "joss": {
    "hold_until_morning": "Light",
    "promise": "Neutral",
    "radiant_hammer": "Light"
  },
  "kharos": {
    "lure": "Nature",
    "wound": "Dark",
    "shears": "Nature"
  },
  "konwu": {
    "nine_days_falling": "Lightning",
    "grey_of_the_peak": "Neutral",
    "ruyi_at_his_word": "Nature"
  },
  "korvux": {
    "runs_hot": "Fire",
    "one_burning_stride": "Fire",
    "paid_in_pieces": "Light"
  },
  "linnet": {
    "mending_line": "Light",
    "gold_line": "Light",
    "the_shears": "Dark"
  },
  "lumi": {
    "fourth_morning": "Light",
    "quiet_hour": "Dark",
    "first_light": "Lightning"
  },
  "lysara": {
    "long_night": "Dark",
    "shared_dream": "Light",
    "lantern_moth": "Nature"
  },
  "maren": {
    "six_fathoms": "Ice",
    "old_hull": "Neutral",
    "sea_gives_back": "Water"
  },
  "mellan": {
    "gentle_rule": "Light",
    "the_leash": "Nature",
    "replaced_by_morning": "Nature"
  },
  "meridian": {
    "long_shot": "Neutral",
    "gold_ink": "Dark",
    "thirty_two_years": "Lightning"
  },
  "mirelle": {
    "rosewater": "Light",
    "lily_and_poppy": "Nature",
    "hundred_eyes": "Dark"
  },
  "hero61": {
    "open_hall": "Light",
    "iron_gate": "Neutral",
    "road_before_the_bell": "Light"
  },
  "nerisse": {
    "drifting_star": "Light",
    "what_the_deep_hears": "Water",
    "ships_bell": "Water"
  },
  "nox": {
    "fence": "Light",
    "just_before": "Dark",
    "luck": "Lightning"
  },
  "oakmir": {
    "heartwood": "Light",
    "thorned_wood": "Nature",
    "turning_year": "Nature"
  },
  "orryn": {
    "fortieth_chamber": "Neutral",
    "the_spiral": "Water",
    "ocean_without_shore": "Water"
  },
  "pellucid": {
    "glass_crust": "Fire",
    "rook": "Neutral",
    "falling_mountain": "Fire"
  },
  "pyroclast": {
    "the_debt": "Fire",
    "eruption": "Fire",
    "nobody_holds_her": "Neutral"
  },
  "quorrel": {
    "order_in_the_court": "Neutral",
    "six_gavels": "Dark",
    "since_the_eleventh_day": "Lightning"
  },
  "rafe": {
    "fourth_shot": "Neutral",
    "collector": "Water",
    "saber_and_smoke": "Dark"
  },
  "rhukk": {
    "straight_through": "Nature",
    "one_tunnel": "Neutral",
    "elders_back": "Light"
  },
  "rivet": {
    "long_workshop": "Neutral",
    "close_work": "Lightning",
    "nutcracker": "Neutral"
  },
  "seyla": {
    "count": "Lightning",
    "lingering": "Nature",
    "crowd": "Neutral"
  },
  "sloe": {
    "one_man_enough_time": "Neutral",
    "tanglewood": "Nature",
    "empty_the_quiver": "Nature"
  },
  "sorrel": {
    "stacked_deck": "Neutral",
    "honest_cards": "Lightning",
    "signed": "Dark"
  },
  "sylthaine": {
    "winter_seal": "Ice",
    "shatterpoint": "Ice",
    "snowwarden": "Light"
  },
  "tessit": {
    "the_ledger": "Lightning",
    "unwinding": "Light",
    "broken_glass": "Dark"
  },
  "tharl": {
    "every_scale": "Neutral",
    "striking_blocks": "Neutral",
    "rolling_coil": "Lightning"
  },
  "tick": {
    "strike_the_quarters": "Lightning",
    "the_key_in_the_back": "Lightning",
    "built_to_wait": "Neutral"
  },
  "tolley": {
    "melt_and_pour": "Fire",
    "worth_making": "Light",
    "furnace_refused": "Fire"
  },
  "umbris": {
    "spreading_dark": "Nature",
    "withheld_light": "Dark",
    "one_candle": "Dark"
  },
  "vaelora": {
    "patient_cat": "Dark",
    "winter_comes_down": "Ice",
    "three_weeks_hungry": "Nature"
  },
  "vesper": {
    "red_pen": "Dark",
    "second_verse": "Neutral",
    "scriptorium": "Lightning"
  },
  "vex": {
    "ropewalker": "Neutral",
    "slow_cut": "Dark",
    "short_list": "Lightning"
  },
  "veyr": {
    "trench": "Water",
    "other_half": "Water",
    "too_light": "Lightning"
  },
  "vireo": {
    "listening_hall": "Light",
    "dissonance": "Dark",
    "living_instrument": "Lightning"
  },
  "vulmar": {
    "gathering_weight": "Neutral",
    "falling_bodies": "Lightning",
    "raised_lotus": "Light"
  },
  "yenna": {
    "what_comes_back": "Neutral",
    "point_and_laugh": "Nature",
    "afraid_at_somebody_else": "Dark"
  },
  "zahri": {
    "never_stand_still": "Lightning",
    "herd_remembered": "Dark",
    "sun_lance": "Light"
  }
}
if(typeof module!=='undefined'&&module.exports) module.exports=TALENT_TREE_ELEMENT; else root.TALENT_TREE_ELEMENT=TALENT_TREE_ELEMENT;
})(typeof window!=='undefined'?window:globalThis);
