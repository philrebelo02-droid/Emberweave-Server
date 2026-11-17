/* TALENT TREE COLOURS (16 Nov 2026). Phil: "each talent TAB specifically gets it own color scheme based on the spec" - and a hero's three tree tabs
   are never all the same colour. heroKey -> treeId -> one of the eight painted kits in assets/img/ui/talents/<Element>/:
   Fire, Ice, Water, Nature, Light, Dark, Lightning, Neutral. A tree with no entry takes the hero's element (AFF_ELEMENT in the page), then Neutral.
   The page only reads this table to pick the art; nothing in a fight or in the rules uses it.
   These are Claude's first guesses from each tree's name, role and text (the comment on each line says why), to be replaced by the confirmed table
   (TALENT UI ART 16NOV2026/TREE TYPES.json) when it comes. */
(function(root){
const TALENT_TREE_ELEMENT={
  vael:{red_harvest:'Dark',ironblood:'Fire',ashford_wall:'Neutral'},                      // the hunt and its bleeding / Temper heats and burns / a plain shield wall
  absalie:{empty_chair:'Dark',great_knot:'Dark',the_unsaid:'Lightning'},                 // unmaking, the abyss / gravity tangle / silences that feed energy
  aldren:{bestiary:'Dark',rewrite:'Dark',living_book:'Neutral'},                         // ink horrors / reversing buffs / paper pages
  ambrel:{ringing_hours:'Light',incense_penance:'Light',gates:'Neutral'},                // sacred bells / sanctuary healer / masonry gates
  askel:{ford:'Water',standard:'Neutral',charge:'Nature'},                               // the ford, Breakwater / a banner / antlers and the rut
  astra:{slow_burn:'Fire',held_star:'Light',second_sky:'Dark'},                          // burns / starlight blast / nebula, the night sky
  aureth:{hungry_brother:'Dark',mending_brother:'Light',third_brother:'Neutral'},        // Dark stance / Light stance / the balance of both
  bloatus:{plague_king:'Nature',drowned_court:'Water',kept_by_the_marsh:'Nature'},       // poison / Swampcall, Waterlogged / marsh sustain
  brannus:{champion:'Neutral',bronze_wheel:'Neutral',lions_pride:'Light'},               // arena showman / bronze wheel / golden lion, shields
  calypsa:{never_bit_first:'Water',straight_lines:'Water',party_piece:'Lightning'},      // tidal counters / Soak / the storm showpiece
  carn:{the_price:'Neutral',ferrow_crossing:'Water',the_bottle:'Lightning'},             // paid in HP / the river crossing, Red Current / ever faster
  ceraline:{guest_list:'Fire',next_course:'Fire',the_host:'Dark'},                       // hot wax / Scald / black candles
  dandra:{petal_by_petal:'Nature',three_bees:'Nature',gold_lantern:'Light'},             // petals / bees / the lantern
  deepcleft:{seam_reader:'Neutral',nine_days_under:'Dark',undermine:'Nature'},           // armor breaking / buried below / ground and quakes
  fritz:{livewire:'Lightning',half_a_heartbeat:'Ice',storm_courier:'Lightning'},         // lightning / the stopped watch, frozen time / storm support
  grimsby:{compound_interest:'Neutral',eviction:'Neutral',ninety_one_entries:'Dark'},    // the debt / taunt and guard / a field-wide curse
  grosk:{sunkfen_hold:'Water',old_jaws:'Water',mirewall:'Nature'},                       // the sunken fen / the crocodile's death roll / the mire wall
  gruel:{ledger:'Neutral',brass_scales:'Light',appetite:'Nature'},                       // coin / the scales / feasting
  hobb:{rings_false:'Neutral',carrying_the_town:'Light',on_the_wheel:'Fire'},            // breaking armour / glaze that hardens / the kiln
  hollow:{commission:'Dark',every_cut:'Neutral',space_between:'Dark'},                   // Dusk, the contract / knives / misses and misdirection
  hurne:{the_swineherd:'Nature',feed_them:'Nature',between_them_and_the_road:'Fire'},    // the herd / feeding / enemies Smoulder
  iver:{twelfth_strike:'Lightning',lightning_rod:'Lightning',stormfront:'Water'},        // Static Charge / the Rod / the Thunderhead's storm
  joss:{hold_until_morning:'Light',promise:'Neutral',radiant_hammer:'Light'},            // Dawnlight / a sworn guard / radiant hammer
  kharos:{lure:'Nature',wound:'Dark',shears:'Nature'},                                   // camouflage / Withers, executions / Bloomstep
  konwu:{nine_days_falling:'Lightning',grey_of_the_peak:'Neutral',ruyi_at_his_word:'Light'},   // the fast kick and chase / greystone / the golden staff
  korvux:{runs_hot:'Fire',one_burning_stride:'Fire',paid_in_pieces:'Light'},             // Emberskin / burning dash / the falling star
  linnet:{mending_line:'Neutral',gold_line:'Light',the_shears:'Dark'},                   // stitches / Golden Thread / unweaving
  lumi:{fourth_morning:'Light',quiet_hour:'Dark',first_light:'Fire'},                    // Dawnward / Hush / Kindles the team
  lysara:{long_night:'Dark',shared_dream:'Nature',lantern_moth:'Light'},                 // sleep, the night / Cocoons / the Lantern
  maren:{six_fathoms:'Ice',old_hull:'Neutral',sea_gives_back:'Water'},                   // cold water, numb hands / the hull / the sea
  mellan:{gentle_rule:'Light',the_leash:'Nature',replaced_by_morning:'Nature'},          // honey / hornets / the colony
  meridian:{long_shot:'Neutral',gold_ink:'Light',thirty_two_years:'Neutral'},            // the long shot / gold ink / the long road
  mirelle:{rosewater:'Nature',lily_and_poppy:'Dark',hundred_eyes:'Light'},               // the rose / poppy sleep, dreams / her plumage
  hero61:{open_hall:'Light',iron_gate:'Neutral',road_before_the_bell:'Dark'},            // Morvayne: the healer's hall / iron / the evening road, the fallen
  nerisse:{drifting_star:'Water',what_the_deep_hears:'Dark',ships_bell:'Water'},         // phosphor orb / the deep / Drowned
  nox:{fence:'Lightning',just_before:'Dark',luck:'Light'},                               // stolen energy / the ultimate thief / fortune
  oakmir:{heartwood:'Nature',thorned_wood:'Nature',turning_year:'Light'},                // sap / thorns and roots / the seasons' sun
  orryn:{fortieth_chamber:'Dark',the_spiral:'Water',ocean_without_shore:'Water'},        // crushing pressure / the current / the flood
  pellucid:{glass_crust:'Fire',rook:'Neutral',falling_mountain:'Fire'},                  // heat leaks / the immovable rook / Knuckle Heat
  pyroclast:{the_debt:'Fire',eruption:'Fire',nobody_holds_her:'Lightning'},              // Scorch debts / magma / bursts free, the kiter
  quorrel:{order_in_the_court:'Light',six_gavels:'Dark',since_the_eleventh_day:'Neutral'},   // the law / the executioner / the tireless duelist
  rafe:{fourth_shot:'Fire',collector:'Water',saber_and_smoke:'Dark'},                    // gunpowder / the grappling hook, the sea / smoke
  rhukk:{straight_through:'Neutral',one_tunnel:'Nature',elders_back:'Neutral'},          // the charge / planted in the ground / the carved shell
  rivet:{long_workshop:'Neutral',close_work:'Lightning',nutcracker:'Lightning'},         // the workshop's guns / Torque / Cracks and repairs
  seyla:{count:'Neutral',lingering:'Nature',crowd:'Light'},                              // the beat / venom / the dancer
  sloe:{one_man_enough_time:'Neutral',tanglewood:'Nature',empty_the_quiver:'Nature'},    // the patient hunter / brambles / Greenfall
  sorrel:{stacked_deck:'Dark',honest_cards:'Light',signed:'Dark'},                       // palmed cards / the gambler's luck / the signed mark
  sylthaine:{winter_seal:'Ice',shatterpoint:'Ice',snowwarden:'Light'},                   // the Seal / Hailstones / the shields of the protector
  tessit:{the_ledger:'Lightning',unwinding:'Light',broken_glass:'Dark'},                 // stolen speed / cleansing / stolen moments
  tharl:{every_scale:'Ice',striking_blocks:'Neutral',rolling_coil:'Ice'},                // the plated wall / quarry stone / Avalanche
  tick:{strike_the_quarters:'Lightning',the_key_in_the_back:'Fire',built_to_wait:'Neutral'},   // Static / Strain, overwound / the long grind
  tolley:{melt_and_pour:'Fire',worth_making:'Light',furnace_refused:'Fire'},             // molten metal / tempering an ally / the furnace
  umbris:{spreading_dark:'Dark',withheld_light:'Dark',one_candle:'Fire'},                // rot / Dimmed / the Candle
  vaelora:{patient_cat:'Dark',winter_comes_down:'Ice',three_weeks_hungry:'Neutral'},     // the stalk / frost quills / the hungry duelist
  vesper:{red_pen:'Fire',second_verse:'Dark',scriptorium:'Light'},                       // the red pen / ink / the safe desk
  vex:{ropewalker:'Neutral',slow_cut:'Dark',short_list:'Lightning'},                     // the rope / Deep Wounds / quick dodges
  veyr:{trench:'Water',other_half:'Dark',too_light:'Lightning'},                         // Deepwater / the mantle / Drift and crits
  vireo:{listening_hall:'Light',dissonance:'Lightning',living_instrument:'Neutral'},     // the healer / the Broken Chord / tempo
  vulmar:{gathering_weight:'Neutral',falling_bodies:'Neutral',raised_lotus:'Light'},     // Heft / Impact / the lotus
  yenna:{what_comes_back:'Neutral',point_and_laugh:'Dark',afraid_at_somebody_else:'Dark'},   // the bone / the pack / fear
  zahri:{never_stand_still:'Fire',herd_remembered:'Neutral',sun_lance:'Light'}           // the sun's heat at noon / the mirages / Sunlit
};
if(typeof module!=='undefined'&&module.exports) module.exports=TALENT_TREE_ELEMENT; else root.TALENT_TREE_ELEMENT=TALENT_TREE_ELEMENT;
})(typeof window!=='undefined'?window:globalThis);
