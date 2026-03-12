import { useRef, useState, useEffect, useCallback } from "react";
import { Box, Input, VStack, HStack, Image, Text, Spinner } from "@chakra-ui/react";
import useSpotifyStore from "../../../store/useSpotifyStore";

export default function SearchBar() {
  const { query, setQuery, search, searchResults, isSearching, selectTrack } =
    useSpotifyStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  const debouncedSearch = useCallback(
    (value) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => search(value), 350);
    },
    [search]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    setShowDropdown(searchResults.length > 0);
  }, [searchResults]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleSelect = (track) => {
    setShowDropdown(false);
    selectTrack(track);
  };

  return (
    <Box ref={containerRef} position="relative" w="100%" maxW="600px" zIndex="10">
      <Box position="relative">
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          placeholder="Search for a song..."
          size="lg"
          bg="#1e1e1e"
          border="1px solid"
          borderColor="#3a3a3a"
          color="white"
          _placeholder={{ color: "#888" }}
          _focus={{ borderColor: "#1DB954", boxShadow: "0 0 0 1px #1DB954" }}
          borderRadius="full"
          px="6"
          pr="12"
        />
        {isSearching && (
          <Spinner
            color="#1DB954"
            size="sm"
            position="absolute"
            right="16px"
            top="50%"
            transform="translateY(-50%)"
          />
        )}
      </Box>

      {showDropdown && (
        <VStack
          position="absolute"
          top="calc(100% + 4px)"
          left="0"
          w="100%"
          bg="#1e1e1e"
          border="1px solid #3a3a3a"
          borderRadius="lg"
          maxH="420px"
          overflowY="auto"
          zIndex="1500"
          spacing="0"
          boxShadow="0 8px 32px rgba(0,0,0,0.5)"
          py="1"
        >
          {searchResults.map((track) => (
            <HStack
              key={track.id}
              as="button"
              type="button"
              w="100%"
              minH="56px"
              px="4"
              py="3"
              cursor="pointer"
              bg="transparent"
              _hover={{ bg: "#2a2a2a" }}
              _active={{ bg: "#333" }}
              onClick={() => handleSelect(track)}
              spacing="3"
              align="center"
              borderBottom="1px solid #2a2a2a"
              _last={{ borderBottom: "none" }}
            >
              <Image
                src={track.album.imageSmall || track.album.image}
                alt={track.album.name}
                boxSize="40px"
                borderRadius="md"
                objectFit="cover"
                flexShrink="0"
                pointerEvents="none"
                fallbackSrc="https://via.placeholder.com/40/1e1e1e/666?text=+"
              />
              <Box flex="1" minW="0" textAlign="left" pointerEvents="none">
                <Text color="white" fontSize="sm" noOfLines={1} fontWeight="500">
                  {track.name}
                </Text>
                <Text color="#aaa" fontSize="xs" noOfLines={1}>
                  {track.artists.map((a) => a.name).join(", ")}
                </Text>
              </Box>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
